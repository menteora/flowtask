
import { useState, useEffect, useCallback } from 'react';
import { ProjectState } from '../types';
import { createInitialProjectState } from '../constants';
import { dbService } from '../services/db';
import { localStorageService } from '../services/localStorage';

export const useWorkspace = () => {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.init();
        const allStored = await dbService.getAllProjects();
        const savedActiveId = localStorageService.getActiveProjectId();
        const savedOpenIds = localStorageService.getOpenProjectIds();
        
        if (allStored.length > 0) {
          let openProjects = savedOpenIds.length > 0 
            ? allStored.filter(p => savedOpenIds.includes(p.id))
            : [allStored[0]];
          
          if (openProjects.length === 0) openProjects = [allStored[0]];
          
          setProjects(openProjects);
          const idToActivate = savedActiveId && openProjects.some(p => p.id === savedActiveId)
            ? savedActiveId
            : openProjects[0].id;
          
          setActiveProjectId(idToActivate);
        } else {
          const def = createInitialProjectState();
          setProjects([def]);
          setActiveProjectId(def.id);
          await dbService.saveProject(def);
        }
      } finally { setIsInitializing(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      localStorageService.saveActiveProjectId(activeProjectId);
      localStorageService.saveOpenProjectIds(projects.map(p => p.id));
    }
  }, [activeProjectId, projects, isInitializing]);

  const switchProject = useCallback((id: string) => setActiveProjectId(id), []);

  return { 
    projects, setProjects, 
    activeProjectId, setActiveProjectId, 
    isInitializing, switchProject 
  };
};
