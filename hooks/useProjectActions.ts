// Added React import to resolve missing namespace error
import React, { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState } from '../types';
import { persistenceService } from '../services/persistence';
import { dbService } from '../services/db';
import { createInitialProjectState } from '../constants';

export const useProjectActions = (
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>,
  activeProjectId: string,
  setActiveProjectId: (id: string) => void,
  isOfflineMode: boolean,
  supabaseClient: SupabaseClient | null
) => {
  
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

  const deleteProject = useCallback(async (id: string) => {
    if (confirm("Eliminare definitivamente questo progetto dal database locale?")) {
      await dbService.deleteProject(id); 
      setProjects(p => p.filter(x => x.id !== id)); 
    }
  }, [setProjects]);

  const renameProject = useCallback((name: string) => {
    updateProject({ name });
  }, [updateProject]);

  return { createProject, updateProject, deleteProject, renameProject };
};