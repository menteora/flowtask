
import { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Task, Branch } from '../types';
import { persistenceService } from '../services/persistence';

const generateId = () => crypto.randomUUID();

/**
 * Trova il responsabile effettivo risalendo la gerarchia dei rami.
 */
const getEffectiveResponsibleId = (branches: Record<string, Branch>, branchId: string): string | undefined => {
  const b = branches[branchId];
  if (!b) return undefined;
  if (b.responsibleId) return b.responsibleId;
  if (b.parentIds && b.parentIds.length > 0) {
    // Risale il primo genitore disponibile
    return getEffectiveResponsibleId(branches, b.parentIds[0]);
  }
  return undefined;
};

export const useTaskActions = (
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: SupabaseClient | null
) => {
  const addTask = useCallback((branchId: string, title: string) => {
    const newId = generateId();
    const now = new Date().toISOString();
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;

      // Ereditarietà responsabile
      const defaultAssigneeId = getEffectiveResponsibleId(p.branches, branchId);

      const newTask: Task = { 
        id: newId, 
        title, 
        completed: false, 
        version: 1, 
        updatedAt: now, 
        position: b.tasks.length,
        assigneeId: defaultAssigneeId
      };

      const nextBranch = { ...b, tasks: [...b.tasks, newTask] };
      const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
      persistenceService.saveTask(branchId, newTask, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updateTask = useCallback((branchId: string, taskId: string, updates: Partial<Task>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const task = b.tasks.find(t => t.id === taskId);
      if (!task) return p;
      const nextTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
      const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: b.tasks.map(t => t.id === taskId ? nextTask : t) } } };
      persistenceService.saveTask(branchId, nextTask, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteTask = useCallback((branchId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: b.tasks.filter(t => t.id !== taskId) } } };
      persistenceService.deleteTask(taskId, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveTask = useCallback((branchId: string, taskId: string, direction: 'up' | 'down') => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const newTasks = [...b.tasks];
      const idx = newTasks.findIndex(t => t.id === taskId);
      if (idx === -1) return p;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= newTasks.length) return p;
      [newTasks[idx], newTasks[targetIdx]] = [newTasks[targetIdx], newTasks[idx]];
      const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: newTasks.map((t, i) => ({ ...t, position: i, updatedAt: new Date().toISOString() })) } } };
      nextState.branches[branchId].tasks.forEach(t => persistenceService.saveTask(branchId, t, isOfflineMode, supabaseClient, nextState));
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveTaskToBranch = useCallback((taskId: string, sourceBranchId: string, targetBranchId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const source = p.branches[sourceBranchId];
      const target = p.branches[targetBranchId];
      if (!source || !target) return p;
      const task = source.tasks.find(t => t.id === taskId);
      if (!task) return p;
      const nextState = { ...p, branches: { ...p.branches, [sourceBranchId]: { ...source, tasks: source.tasks.filter(t => t.id !== taskId) }, [targetBranchId]: { ...target, tasks: [...target.tasks, { ...task, position: target.tasks.length, updatedAt: new Date().toISOString() }] } } };
      persistenceService.saveTask(targetBranchId, task, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkUpdateTasks = useCallback((branchId: string, text: string) => {
    const titles = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const now = new Date().toISOString();
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;

      // Ereditarietà responsabile per i nuovi task creati via bulk
      const defaultAssigneeId = getEffectiveResponsibleId(p.branches, branchId);

      const nextTasks: Task[] = [];
      const tasksToRemove = [...b.tasks];
      
      titles.forEach((title, index) => {
        const existingIdx = tasksToRemove.findIndex(t => t.title === title);
        if (existingIdx !== -1) {
          const existing = tasksToRemove.splice(existingIdx, 1)[0];
          nextTasks.push({ ...existing, position: index, updatedAt: now });
        } else {
          nextTasks.push({ 
            id: generateId(), 
            title, 
            completed: false, 
            version: 1, 
            updatedAt: now, 
            position: index,
            assigneeId: defaultAssigneeId
          });
        }
      });

      const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: nextTasks } } };
      tasksToRemove.forEach(t => persistenceService.deleteTask(t.id, isOfflineMode, supabaseClient, nextState));
      nextTasks.forEach(t => persistenceService.saveTask(branchId, t, isOfflineMode, supabaseClient, nextState));
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkMoveTasks = useCallback((taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const source = p.branches[sourceBranchId];
      const target = p.branches[targetBranchId];
      if (!source || !target) return p;
      const movedTasks = source.tasks.filter(t => taskIds.includes(t.id));
      const remainingTasks = source.tasks.filter(t => !taskIds.includes(t.id));
      const nextState = { ...p, branches: { ...p.branches, [sourceBranchId]: { ...source, tasks: remainingTasks }, [targetBranchId]: { ...target, tasks: [...target.tasks, ...movedTasks.map((t, i) => ({ ...t, position: target.tasks.length + i, updatedAt: new Date().toISOString() }))] } } };
      movedTasks.forEach(t => persistenceService.saveTask(targetBranchId, t, isOfflineMode, supabaseClient, nextState));
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks };
};
