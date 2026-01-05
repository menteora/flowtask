
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';

export const supabaseService = {
  async fetchProjects(client: SupabaseClient) {
    return client.from('flowtask_projects').select('*').is('deleted_at', null);
  },

  async fetchBranches(client: SupabaseClient, projectId: string) {
    return client.from('flowtask_branches').select('*').eq('project_id', projectId).is('deleted_at', null);
  },

  async softDeleteProject(client: SupabaseClient, id: string) {
    return client.from('flowtask_projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeleteBranch(client: SupabaseClient, id: string) {
    return client.from('flowtask_branches').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeleteTask(client: SupabaseClient, id: string) {
    return client.from('flowtask_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeletePerson(client: SupabaseClient, id: string) {
    return client.from('flowtask_people').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  /**
   * Implementazione OCC + Soft Delete Aware.
   */
  async upsertEntity(client: SupabaseClient, table: string, payload: any) {
    const { version, id, updatedAt, deletedAt, isDirty, ...rest } = payload;
    
    if (payload.deleted_at) {
        return client.from(table).update({ deleted_at: payload.deleted_at, version: (version || 1) + 1 }).eq('id', id);
    }

    if (version && version > 1) {
      const { data, error } = await client
        .from(table)
        .update({ ...rest, version: version + 1 })
        .eq('id', id)
        .eq('version', version)
        .select();

      if (error) return { error };
      if (!data || data.length === 0) {
        return { error: { message: 'CONCURRENCY_CONFLICT', details: 'Il record è stato modificato o eliminato.' } };
      }
      return { data };
    }

    return client.from(table).upsert(payload);
  },

  async downloadFullProject(client: SupabaseClient, id: string): Promise<ProjectState> {
    const { data: p, error: pErr } = await client.from('flowtask_projects').select('*').eq('id', id).is('deleted_at', null).single();
    if (pErr) throw pErr;

    const [peopleRes, branchesRes] = await Promise.all([
      client.from('flowtask_people').select('*').eq('project_id', id).is('deleted_at', null),
      client.from('flowtask_branches').select('*').eq('project_id', id).is('deleted_at', null)
    ]);

    const branchIds = branchesRes.data?.map(b => b.id) || [];
    let tasksRes: any[] = [];
    if (branchIds.length > 0) {
        const { data } = await client.from('flowtask_tasks')
          .select('*')
          .in('branch_id', branchIds)
          .is('deleted_at', null);
        tasksRes = data || [];
    }

    const people: Person[] = (peopleRes.data || []).map(p => ({
      id: p.id, name: p.name, email: p.email, phone: p.phone, initials: p.initials, color: p.color, 
      version: p.version || 1, updatedAt: p.updated_at
    }));

    const branches: Record<string, Branch> = {};
    (branchesRes.data || []).forEach(b => {
      const bTasks = tasksRes
        .filter(t => t.branch_id === b.id)
        .sort((x, y) => (x.position || 0) - (y.position || 0))
        .map(t => ({
          id: t.id, title: t.title, description: t.description, completed: t.completed,
          completedAt: t.completed_at, assigneeId: t.assignee_id, dueDate: t.due_date, pinned: t.pinned || false,
          position: t.position || 0, version: t.version || 1, updatedAt: t.updated_at
        }));

      branches[b.id] = {
        id: b.id, title: b.title, description: b.description, status: b.status as BranchStatus,
        tasks: bTasks, childrenIds: b.children_ids || [], parentIds: b.parent_ids || [],
        startDate: b.start_date, endDate: b.end_date, dueDate: b.due_date,
        archived: b.archived, collapsed: b.collapsed, isLabel: b.is_label,
        isSprint: b.is_sprint || false, sprintCounter: b.sprint_counter || 1,
        responsibleId: b.responsible_id, version: b.version || 1, updatedAt: b.updated_at
      };
    });

    return { id: p.id, name: p.name, rootBranchId: p.root_branch_id, branches, people, version: p.version || 1, updatedAt: p.updated_at };
  },

  async uploadFullProject(client: SupabaseClient, project: ProjectState, userId: string) {
    await this.upsertEntity(client, 'flowtask_projects', {
      id: project.id, name: project.name, root_branch_id: project.rootBranchId, owner_id: userId, version: project.version
    });

    for (const person of project.people) {
      await this.upsertEntity(client, 'flowtask_people', { ...person, project_id: project.id });
    }

    for (const b of Object.values(project.branches)) {
      // Fixed: correctly accessed camelCase properties on Branch object
      await this.upsertEntity(client, 'flowtask_branches', {
          id: b.id, project_id: project.id, title: b.title, description: b.description, status: b.status,
          start_date: b.startDate, end_date: b.endDate, due_date: b.dueDate, archived: b.archived,
          collapsed: b.collapsed, is_label: b.isLabel, is_sprint: b.isSprint || false,
          sprint_counter: b.sprintCounter || 1, parent_ids: b.parentIds, children_ids: b.childrenIds,
          responsible_id: b.responsibleId, version: b.version
      });

      for (const t of b.tasks) {
        await this.upsertEntity(client, 'flowtask_tasks', {
          id: t.id, branch_id: b.id, title: t.title, description: t.description, assignee_id: t.assigneeId,
          due_date: t.dueDate, completed: t.completed, completed_at: t.completedAt, position: t.position, pinned: t.pinned || false, version: t.version
        });
      }
    }
  }
};
