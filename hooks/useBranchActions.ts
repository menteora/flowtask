// Added React import to resolve missing namespace error
import React, { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, BranchStatus } from '../types';
import { persistenceService } from '../services/persistence';

const generateId = () => crypto.randomUUID();

export const useBranchActions = (
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: SupabaseClient | null
) => {
  const addBranch = useCallback((parentId: string) => {
    const newId = generateId();
    const now = new Date().toISOString();
    
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const parent = p.branches[parentId];
      if (!parent) return p;

      let title = 'Nuovo Ramo';
      let nextParent = { ...parent };

      if (parent.isSprint) {
          const counter = parent.sprintCounter || 1;
          const year = new Date().getFullYear().toString().slice(-2);
          const paddedCounter = String(counter).padStart(2, '0');
          title = `${parent.title} ${year}-${paddedCounter}`;
          
          nextParent.sprintCounter = counter + 1;
          nextParent.updatedAt = now;
      }

      const newBranch: Branch = { 
        id: newId, 
        title, 
        status: BranchStatus.PLANNED, 
        tasks: [], 
        childrenIds: [], 
        parentIds: [parentId], 
        position: parent.childrenIds.length,
        version: 1, 
        updatedAt: now 
      };

      const nextState = {
        ...p,
        branches: {
          ...p.branches,
          [newId]: newBranch,
          [parentId]: { ...nextParent, childrenIds: [...nextParent.childrenIds, newId] }
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

  const moveBranch = useCallback((branchId: string, direction: 'prev' | 'next') => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const branch = p.branches[branchId];
      if (!branch || branch.parentIds.length === 0) return p;
      
      const parentId = branch.parentIds[0];
      const parent = p.branches[parentId];
      if (!parent) return p;

      const newChildrenIds = [...parent.childrenIds];
      const idx = newChildrenIds.indexOf(branchId);
      if (idx === -1) return p;

      const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= newChildrenIds.length) return p;

      // Swap
      [newChildrenIds[idx], newChildrenIds[targetIdx]] = [newChildrenIds[targetIdx], newChildrenIds[idx]];

      const nextParent = { ...parent, childrenIds: newChildrenIds, updatedAt: new Date().toISOString() };
      const nextState = { ...p, branches: { ...p.branches, [parentId]: nextParent } };
      
      persistenceService.saveBranch(p.id, nextParent, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteBranch = useCallback((branchId: string) => {
    setProjects(prev => {
      const project = prev.find(p => p.id === activeProjectId);
      if (!project || !project.branches[branchId] || branchId === project.rootBranchId) return prev;

      const target = project.branches[branchId];
      const nextBranches = { ...project.branches };
      
      target.parentIds.forEach(pid => {
        if (nextBranches[pid]) {
          nextBranches[pid] = { 
            ...nextBranches[pid], 
            childrenIds: nextBranches[pid].childrenIds.filter(id => id !== branchId),
            updatedAt: new Date().toISOString()
          };
        }
      });

      target.childrenIds.forEach(cid => {
        if (nextBranches[cid]) {
          nextBranches[cid] = {
            ...nextBranches[cid],
            parentIds: nextBranches[cid].parentIds.filter(id => id !== branchId),
            updatedAt: new Date().toISOString()
          };
        }
      });

      delete nextBranches[branchId];
      const nextState = { ...project, branches: nextBranches };
      
      persistenceService.deleteBranch(branchId, isOfflineMode, supabaseClient, nextState);
      target.parentIds.forEach(pid => {
          if (nextState.branches[pid]) {
              persistenceService.saveBranch(project.id, nextState.branches[pid], isOfflineMode, supabaseClient, nextState);
          }
      });
      target.childrenIds.forEach(cid => {
          if (nextState.branches[cid]) {
              persistenceService.saveBranch(project.id, nextState.branches[cid], isOfflineMode, supabaseClient, nextState);
          }
      });

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
      if (!child || !parent || childId === parentId) return p;
      if (child.parentIds.includes(parentId)) return p;

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

  return { addBranch, updateBranch, moveBranch, deleteBranch, linkBranch, unlinkBranch, toggleBranchArchive };
};