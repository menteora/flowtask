
import { dbService } from './db';
import { supabaseService } from './supabase';
import { ProjectState, Branch, Task, Person, SyncOperation } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

export const persistenceService = {
  /**
   * Salva sempre in locale (IndexedDB) e, se non siamo in modalità offline pura,
   * accoda l'operazione per la sincronizzazione cloud.
   */
  async saveProject(project: ProjectState, isOfflineMode: boolean, client: SupabaseClient | null) {
    await dbService.saveProject(project);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: project.id,
            table: 'flowtask_projects',
            action: 'upsert',
            payload: { id: project.id, name: project.name, root_branch_id: project.rootBranchId, version: project.version },
            timestamp: Date.now()
        });
    }
  },

  async saveBranch(projectId: string, branch: Branch, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: branch.id,
            table: 'flowtask_branches',
            action: 'upsert',
            payload: { 
                id: branch.id, project_id: projectId, title: branch.title, status: branch.status, 
                description: branch.description, start_date: branch.startDate, due_date: branch.dueDate, 
                archived: branch.archived, collapsed: branch.collapsed, is_label: branch.isLabel,
                is_sprint: branch.isSprint, sprint_counter: branch.sprintCounter,
                parent_ids: branch.parentIds, children_ids: branch.childrenIds, 
                responsible_id: branch.responsibleId, position: branch.position, version: branch.version 
            },
            timestamp: Date.now()
        });
    }
  },

  async deleteBranch(branchId: string, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: branchId,
            table: 'flowtask_branches',
            action: 'delete',
            payload: { id: branchId },
            timestamp: Date.now()
        });
    }
  },

  async saveTask(branchId: string, task: Task, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: task.id,
            table: 'flowtask_tasks',
            action: 'upsert',
            payload: { 
                id: task.id, branch_id: branchId, title: task.title, description: task.description, 
                assignee_id: task.assigneeId, due_date: task.dueDate, completed: task.completed, 
                completed_at: task.completedAt, position: task.position, pinned: task.pinned, version: task.version 
            },
            timestamp: Date.now()
        });
    }
  },

  async deleteTask(taskId: string, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: taskId,
            table: 'flowtask_tasks',
            action: 'delete',
            payload: { id: taskId },
            timestamp: Date.now()
        });
    }
  },

  async savePerson(projectId: string, person: Person, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: person.id,
            table: 'flowtask_people',
            action: 'upsert',
            payload: { 
                id: person.id, project_id: projectId, name: person.name, email: person.email, 
                phone: person.phone, initials: person.initials, color: person.color, version: person.version 
            },
            timestamp: Date.now()
        });
    }
  },

  async deletePerson(personId: string, isOfflineMode: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    await dbService.saveProject(fullState);
    if (!isOfflineMode && client) {
        await dbService.addToSyncQueue({
            entityId: personId,
            table: 'flowtask_people',
            action: 'delete',
            payload: { id: personId },
            timestamp: Date.now()
        });
    }
  }
};
