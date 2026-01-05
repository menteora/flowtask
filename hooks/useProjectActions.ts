
import React, { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
import { persistenceService } from '../services/persistence';
import { dbService } from '../services/db';
import { createInitialProjectState } from '../constants';

const generateId = () => crypto.randomUUID();

export const useProjectActions = (
  projects: ProjectState[],
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>,
  activeProjectId: string,
  setActiveProjectId: (id: string) => void,
  isOfflineMode: boolean,
  supabaseClient: SupabaseClient | null
) => {
  
  // --- PROJECT ACTIONS ---

  const createProject = useCallback(async () => {
    const np = createInitialProjectState();
    setProjects(prev => [...prev, np]);
    setActiveProjectId(np.id);
    await dbService.saveProject(np);
    persistenceService.saveProject(np, isOfflineMode, supabaseClient);
  }, [isOfflineMode, supabaseClient, setProjects, setActiveProjectId]);

  const updateProject = useCallback((updates: Partial<ProjectState>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const nextState = { ...p, ...updates, updatedAt: new Date().toISOString() };
      persistenceService.saveProject(nextState, isOfflineMode, supabaseClient);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  // --- BRANCH ACTIONS ---

  const addBranch = useCallback((parentId: string) => {
    const newId = generateId();
    const now = new Date().toISOString();
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const parent = p.branches[parentId];
      if (!parent) return p;

      const newBranch: Branch = { 
        id: newId, title: 'Nuovo Ramo', status: BranchStatus.PLANNED, tasks: [], 
        childrenIds: [], parentIds: [parentId], version: 1, updatedAt: now 
      };

      const nextState = {
        ...p,
        branches: {
          ...p.branches,
          [newId]: newBranch,
          [parentId]: { ...parent, childrenIds: [...parent.childrenIds, newId], updatedAt: now }
        }
      };

      persistenceService.saveBranch(p.id, newBranch, isOfflineMode, supabaseClient, nextState);
      persistenceService.saveBranch(p.id, nextState.branches[parentId], isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const nextBranch = { ...b, ...updates, updatedAt: new Date().toISOString() };
      const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
      persistenceService.saveBranch(p.id, nextBranch, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteBranch = useCallback((branchId: string) => {
    setProjects(prev => {
      const project = prev.find(p => p.id === activeProjectId);
      if (!project || !project.branches[branchId]) return prev;

      const target = project.branches[branchId];
      const nextBranches = { ...project.branches };
      
      // Rimuoviamo il riferimento dai genitori
      target.parentIds.forEach(pid => {
        if (nextBranches[pid]) {
          nextBranches[pid] = { 
            ...nextBranches[pid], 
            childrenIds: nextBranches[pid].childrenIds.filter(id => id !== branchId),
            updatedAt: new Date().toISOString()
          };
          persistenceService.saveBranch(project.id, nextBranches[pid], isOfflineMode, supabaseClient, { ...project, branches: nextBranches });
        }
      });

      delete nextBranches[branchId];
      const nextState = { ...project, branches: nextBranches };
      persistenceService.deleteBranch(branchId, isOfflineMode, supabaseClient, nextState);

      return prev.map(p => p.id === activeProjectId ? nextState : p);
    });
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const toggleBranchArchive = useCallback((branchId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const nextBranch = { ...b, archived: !b.archived, updatedAt: new Date().toISOString() };
      const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
      persistenceService.saveBranch(p.id, nextBranch, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const linkBranch = useCallback((childId: string, parentId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const child = p.branches[childId];
      const parent = p.branches[parentId];
      if (!child || !parent) return p;

      const nextState = { 
        ...p, 
        branches: { 
          ...p.branches, 
          [childId]: { ...child, parentIds: [...child.parentIds, parentId], updatedAt: new Date().toISOString() }, 
          [parentId]: { ...parent, childrenIds: [...parent.childrenIds, childId], updatedAt: new Date().toISOString() } 
        } 
      };

      persistenceService.saveBranch(p.id, nextState.branches[childId], isOfflineMode, supabaseClient, nextState);
      persistenceService.saveBranch(p.id, nextState.branches[parentId], isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const unlinkBranch = useCallback((childId: string, parentId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const child = p.branches[childId];
      const parent = p.branches[parentId];
      if (!child || !parent) return p;

      const nextState = { 
        ...p, 
        branches: { 
          ...p.branches, 
          [childId]: { ...child, parentIds: child.parentIds.filter(id => id !== parentId), updatedAt: new Date().toISOString() }, 
          [parentId]: { ...parent, childrenIds: parent.childrenIds.filter(id => id !== childId), updatedAt: new Date().toISOString() } 
        } 
      };

      persistenceService.saveBranch(p.id, nextState.branches[childId], isOfflineMode, supabaseClient, nextState);
      persistenceService.saveBranch(p.id, nextState.branches[parentId], isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  // --- TASK ACTIONS ---

  const addTask = useCallback((branchId: string, title: string) => {
    const newId = generateId();
    const now = new Date().toISOString();
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const b = p.branches[branchId];
      if (!b) return p;
      const newTask: Task = { id: newId, title, completed: false, version: 1, updatedAt: now, position: b.tasks.length };
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
      
      const nextState = { 
        ...p, 
        branches: { 
          ...p.branches, 
          [branchId]: { 
            ...b, 
            tasks: newTasks.map((t, i) => ({ ...t, position: i, updatedAt: new Date().toISOString() })) 
          } 
        } 
      };
      
      nextState.branches[branchId].tasks.forEach(t => {
        persistenceService.saveTask(branchId, t, isOfflineMode, supabaseClient, nextState);
      });

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

      const nextState = { 
        ...p, 
        branches: { 
          ...p.branches, 
          [sourceBranchId]: { ...source, tasks: source.tasks.filter(t => t.id !== taskId) }, 
          [targetBranchId]: { ...target, tasks: [...target.tasks, { ...task, position: target.tasks.length, updatedAt: new Date().toISOString() }] } 
        } 
      };

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
      const nextTasks: Task[] = [];
      const tasksToRemove = [...b.tasks];
      titles.forEach((title, index) => {
        const existingIdx = tasksToRemove.findIndex(t => t.title === title);
        if (existingIdx !== -1) {
          const existing = tasksToRemove.splice(existingIdx, 1)[0];
          nextTasks.push({ ...existing, position: index, updatedAt: now });
        } else {
          nextTasks.push({ id: generateId(), title, completed: false, version: 1, updatedAt: now, position: index });
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
      
      const nextState = {
        ...p,
        branches: {
          ...p.branches,
          [sourceBranchId]: { ...source, tasks: remainingTasks },
          [targetBranchId]: { ...target, tasks: [...target.tasks, ...movedTasks.map((t, i) => ({ ...t, position: target.tasks.length + i, updatedAt: new Date().toISOString() }))] }
        }
      };

      movedTasks.forEach(t => persistenceService.saveTask(targetBranchId, t, isOfflineMode, supabaseClient, nextState));
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  // --- PEOPLE ACTIONS ---

  const addPerson = useCallback((name: string, email?: string, phone?: string) => {
    const newId = generateId();
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newPerson: Person = { 
        id: newId, name, email, phone, initials: name.slice(0,2).toUpperCase(), 
        color: 'bg-indigo-500', version: 1, updatedAt: new Date().toISOString() 
      };
      const nextState = { ...p, people: [...p.people, newPerson] };
      persistenceService.savePerson(p.id, newPerson, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const person = p.people.find(pe => pe.id === id);
      if (!person) return p;
      const nextPerson = { ...person, ...updates, updatedAt: new Date().toISOString() };
      const nextState = { ...p, people: p.people.map(pe => pe.id === id ? nextPerson : pe) };
      persistenceService.savePerson(p.id, nextPerson, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const removePerson = useCallback((id: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const nextState = { ...p, people: p.people.filter(x => x.id !== id) };
      persistenceService.deletePerson(id, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { 
    createProject, updateProject, 
    addBranch, updateBranch, deleteBranch, toggleBranchArchive, linkBranch, unlinkBranch,
    addTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks,
    addPerson, updatePerson, removePerson 
  };
};
