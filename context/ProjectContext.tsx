
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch } from '../types';
import { createInitialProjectState } from '../constants';
import { localStorageService } from '../services/localStorage';
import { supabaseService } from '../services/supabase';
import { dbService } from '../services/db';

// Hooks decomposti
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useWorkspace } from '../hooks/useWorkspace';
import { useProjectActions } from '../hooks/useProjectActions';

interface ProjectContextType {
  state: ProjectState;
  projects: ProjectState[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  session: any;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;
  pendingSyncIds: Set<string>;

  switchProject: (id: string) => void;
  reorderProject: (id: string, direction: 'left' | 'right') => void;
  createProject: () => void;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (name: string) => void;
  closeProject: (id: string) => void;
  loadProject: (newState: ProjectState, activate?: boolean) => void;
  
  setSupabaseConfig: (url: string, key: string) => void;
  logout: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;

  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (id: string, activate?: boolean) => Promise<void>;
  syncAllFromSupabase: () => Promise<void>;
  pullAllFromSupabase: () => Promise<void>;
  listProjectsFromSupabase: () => Promise<any[]>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  getProjectBranchesFromSupabase: (projectId: string) => Promise<any[]>;
  moveLocalBranchToRemoteProject: (branchId: string, targetProjectId: string, targetParentId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const [supabaseConfig, setSupabaseConfigState] = useState(() => localStorageService.getSupabaseConfig());
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorageService.getOfflineMode());
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
      const client = createClient(supabaseConfig.url, supabaseConfig.key);
      setSupabaseClient(client);
      client.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingAuth(false); });
      const { data: { subscription } } = client.auth.onAuthStateChange((_e, s) => setSession(s));
      return () => subscription.unsubscribe();
    } else { setLoadingAuth(false); }
  }, [supabaseConfig]);

  const { projects, setProjects, activeProjectId, setActiveProjectId, isInitializing, switchProject } = useWorkspace();
  const { autoSaveStatus, pendingSyncIds, processSyncQueue } = useSyncEngine(supabaseClient, session, isOfflineMode, showNotification);
  const projActions = useProjectActions(setProjects, activeProjectId, setActiveProjectId, isOfflineMode, supabaseClient);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  const reorderProject = useCallback((id: string, direction: 'left' | 'right') => {
    setProjects(prev => {
        const next = [...prev];
        const idx = next.findIndex(p => p.id === id);
        if (idx === -1) return prev;
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= next.length) return prev;
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        localStorageService.saveOpenProjectIds(next.map(p => p.id));
        return next;
    });
  }, [setProjects]);

  const moveLocalBranchToRemoteProject = async (branchId: string, targetProjectId: string, targetParentId: string) => {
    if (!supabaseClient || !session) return;
    try {
        const branch = activeProject.branches[branchId];
        if (!branch) return;
        await supabaseService.upsertEntity(supabaseClient, 'flowtask_branches', {
            id: branch.id, project_id: targetProjectId, title: branch.title, status: branch.status,
            description: branch.description, start_date: branch.startDate, due_date: branch.dueDate,
            archived: branch.archived, collapsed: branch.collapsed, is_label: branch.isLabel,
            is_sprint: branch.isSprint, sprint_counter: branch.sprintCounter,
            parent_ids: [targetParentId], children_ids: branch.childrenIds,
            responsible_id: branch.responsibleId, version: 1
        });
        for (const t of branch.tasks) {
            await supabaseService.upsertEntity(supabaseClient, 'flowtask_tasks', {
                id: t.id, branch_id: branch.id, title: t.title, description: t.description, assignee_id: t.assigneeId,
                due_date: t.dueDate, completed: t.completed, completed_at: t.completedAt, position: t.position, version: 1
            });
        }
        const { data: targetParentData } = await supabaseClient.from('flowtask_branches').select('children_ids').eq('id', targetParentId).single();
        const nextChildren = Array.from(new Set([...(targetParentData?.children_ids || []), branchId]));
        await supabaseClient.from('flowtask_branches').update({ children_ids: nextChildren }).eq('id', targetParentId);
        showNotification("Ramo migrato correttamente.", "success");
    } catch (err) {
        showNotification("Errore durante la migrazione.", "error");
    }
  };

  const downloadProjectFromSupabase = async (id: string, activate: boolean = true) => {
    if (supabaseClient) {
      try {
        const p = await supabaseService.downloadFullProject(supabaseClient, id);
        await dbService.saveProject(p);
        setProjects(prev => {
            const exists = prev.some(x => x.id === id);
            if (exists) return prev.map(x => x.id === id ? p : x);
            return [...prev, p];
        });
        if (activate) switchProject(id);
        showNotification(`Progetto "${p.name}" pronto.`, "success");
      } catch (err) {
        showNotification("Errore download.", "error");
      }
    }
  };

  const pullAllFromSupabase = async () => {
    if (!supabaseClient || !session) return;
    showNotification("Scaricamento dati dal cloud...", "success");
    try {
      const { data: remoteProjs } = await supabaseService.fetchProjects(supabaseClient);
      if (remoteProjs && remoteProjs.length > 0) {
        const downloaded: ProjectState[] = [];
        for (const rp of remoteProjs) {
          const p = await supabaseService.downloadFullProject(supabaseClient, rp.id);
          await dbService.saveProject(p);
          downloaded.push(p);
        }
        setProjects(prev => {
          const downloadedIds = downloaded.map(d => d.id);
          const remaining = prev.filter(p => !downloadedIds.includes(p.id));
          const newState = [...remaining, ...downloaded];
          localStorageService.saveOpenProjectIds(newState.map(n => n.id));
          return newState;
        });
        showNotification(`${downloaded.length} progetti scaricati correttamente.`, "success");
      } else {
        showNotification("Nessun progetto sul server.", "error");
      }
    } catch (err) {
      showNotification("Errore scaricamento globale.", "error");
    }
  };

  const syncAllFromSupabase = async () => {
    if (!supabaseClient || !session) return;
    showNotification("Sincronizzazione in corso...", "success");
    try {
      await processSyncQueue(); // Spinge prima i cambiamenti locali
      await pullAllFromSupabase(); // Poi scarica le novità
    } catch (err) {
      showNotification("Errore sincronizzazione.", "error");
    }
  };

  const contextValue: ProjectContextType = {
    state: activeProject, projects, setProjects, activeProjectId, setActiveProjectId,
    session, isOfflineMode, loadingAuth, isInitializing, autoSaveStatus, notification,
    supabaseConfig, supabaseClient, pendingSyncIds,
    ...projActions,
    switchProject,
    reorderProject,
    closeProject: (id) => setProjects(p => p.filter(x => x.id !== id)),
    loadProject: (ns, act = true) => { setProjects(prev => [...prev.filter(x => x.id !== ns.id), ns]); if (act) switchProject(ns.id); },
    setSupabaseConfig: (u, k) => { setSupabaseConfigState({url:u, key:k}); localStorageService.saveSupabaseConfig({url:u, key:k}); },
    logout: async () => { if (supabaseClient) await supabaseClient.auth.signOut(); setSession(null); window.location.reload(); },
    enableOfflineMode: () => { setIsOfflineMode(true); localStorageService.saveOfflineMode(true); window.location.reload(); },
    disableOfflineMode: () => { setIsOfflineMode(false); localStorageService.saveOfflineMode(false); window.location.reload(); },
    showNotification,
    uploadProjectToSupabase: async () => { if (supabaseClient && session) await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id); },
    downloadProjectFromSupabase,
    syncAllFromSupabase,
    pullAllFromSupabase,
    listProjectsFromSupabase: async () => supabaseClient ? (await supabaseService.fetchProjects(supabaseClient)).data || [] : [],
    deleteProjectFromSupabase: async (id) => { if (supabaseClient) await supabaseService.softDeleteProject(supabaseClient, id); },
    getProjectBranchesFromSupabase: async (id) => { if (supabaseClient) { const res = await supabaseService.fetchBranches(supabaseClient, id); return res.data || []; } return []; },
    moveLocalBranchToRemoteProject
  };

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
