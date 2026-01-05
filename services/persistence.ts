
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person } from '../types';
import { dbService } from './db';
import { supabaseService } from './supabase';

export const persistenceService = {
  /**
   * Salva lo stato intero o una parte.
   * In modalità Offline salva sempre l'intero oggetto ProjectState su IndexedDB.
   * In modalità Online usa le API atomiche di Supabase.
   */
  async saveProject(state: ProjectState, isOffline: boolean, client: SupabaseClient | null) {
    if (isOffline) {
      await dbService.saveProject(state);
    } else if (client) {
      // Nota: Qui inviamo l'aggiornamento del record progetto
      await supabaseService.upsertEntity(client, 'flowtask_projects', {
        id: state.id,
        name: state.name,
        root_branch_id: state.rootBranchId,
        version: state.version
      });
    }
  },

  async saveBranch(projectId: string, branch: Branch, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_branches', {
        id: branch.id,
        project_id: projectId,
        title: branch.title,
        description: branch.description,
        status: branch.status,
        responsible_id: branch.responsibleId,
        start_date: branch.startDate,
        due_date: branch.dueDate,
        archived: branch.archived,
        collapsed: branch.collapsed,
        is_label: branch.isLabel,
        is_sprint: branch.isSprint,
        sprint_counter: branch.sprintCounter,
        parent_ids: branch.parentIds,
        children_ids: branch.childrenIds,
        version: branch.version
      });
    }
  },

  async deleteBranch(id: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeleteBranch(client, id);
    }
  },

  async saveTask(branchId: string, task: Task, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_tasks', {
        id: task.id,
        branch_id: branchId,
        title: task.title,
        description: task.description,
        assignee_id: task.assigneeId,
        due_date: task.dueDate,
        completed: task.completed,
        completed_at: task.completedAt,
        position: task.position,
        pinned: task.pinned,
        version: task.version
      });
    }
  },

  async deleteTask(id: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeleteTask(client, id);
    }
  },

  async savePerson(projectId: string, person: Person, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_people', {
        ...person,
        project_id: projectId
      });
    }
  },

  async deletePerson(id: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeletePerson(client, id);
    }
  }
};
