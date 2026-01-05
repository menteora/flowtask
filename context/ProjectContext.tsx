
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
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
  activeProjectId: string;
  selectedBranchId: string | null;
  showArchived: boolean;
  showAllProjects: boolean;
  showOnlyOpen: boolean;
  session: any;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;
  pendingSyncIds: Set<string>;

  setSupabaseConfig: (url: string, key: string) => void;
  switchProject: (id: string) => void;
  createProject: () => void;
  closeProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (name: string) => void;
  loadProject: (newState: ProjectState, activate?: boolean) => void;
  selectBranch: (id: string | null) => void;
  toggleShowArchived: () => void;
  toggleShowAllProjects: () => void;
  toggleShowOnlyOpen: () => void;

  addBranch: (parentId: string) => void;
  updateBranch: (branchId: string, updates: Partial<Branch>) => void;
  deleteBranch: (branchId: string) => void;
  linkBranch: (childId: string, parentId: string) => void;
  unlinkBranch: (childId: string, parentId: string) => void;
  setAllBranchesCollapsed: (collapsed: boolean) => void;
  toggleBranchArchive: (branchId: string) => void;

  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToBranch: (taskId: string, sourceBranchId: string, targetBranchId: string) => void;
  bulkUpdateTasks: (branchId: string, text: string) => void;
  bulkMoveTasks: (taskIds: string[], sourceBranchId: string, targetBranchId: string) => void;

  addPerson: (name: string, email?: string, phone?: string) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;

  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (id: string, activate?: boolean) => Promise<void>;
  listProjectsFromSupabase: () => Promise<any[]>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  getProjectBranchesFromSupabase: (projectId: string) => Promise<Branch[]>;
  moveLocalBranchToRemoteProject: (branchId: string, targetProjectId: string, targetParentId: string) => Promise<void>;

  logout: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;

  // View state modals
  readingDescriptionId: string | null;
  setReadingDescriptionId: (id: string | null) => void;
  editingTask: { branchId: string; taskId: string } | null;
  setEditingTask: (val: { branchId: string; taskId: string } | null) => void;
  readingTask: { branchId: string; taskId: string } | null;
  setReadingTask: (val: { branchId: string; taskId: string } | null) => void;
  remindingUserId: string | null;
  setRemindingUserId: (id: string | null) => void;
  messageTemplates: { opening: string; closing: string };
  updateMessageTemplates: (templates: Partial<{ opening: string; closing: string }>) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- UI & NOTIFICATION STATE ---
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // --- MODALS & VIEW STATE ---
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState({ opening: "Ciao {name}, ecco i tuoi task:", closing: "Buon lavoro!" });

  // --- SUPABASE & AUTH ---
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

  // --- BUSINESS LOGIC DECOMPOSITION ---
  const { projects, setProjects, activeProjectId, setActiveProjectId, isInitializing, switchProject } = useWorkspace();
  const { autoSaveStatus, pendingSyncIds } = useSyncEngine(supabaseClient, session, isOfflineMode, showNotification);
  const actions = useProjectActions(projects, setProjects, activeProjectId, setActiveProjectId, isOfflineMode, supabaseClient);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  // Mapping finale delle azioni per il provider
  const contextValue: ProjectContextType = {
    state: activeProject, 
    projects, 
    activeProjectId, 
    selectedBranchId, 
    showArchived, 
    showAllProjects, 
    showOnlyOpen,
    session, 
    isOfflineMode, 
    loadingAuth, 
    isInitializing, 
    autoSaveStatus, 
    notification, 
    supabaseConfig, 
    supabaseClient,
    pendingSyncIds,
    
    // Actions from hook
    ...actions,
    
    // Workspace management
    switchProject,
    setSupabaseConfig: (u, k) => { setSupabaseConfigState({url:u, key:k}); localStorageService.saveSupabaseConfig({url:u, key:k}); },
    selectBranch: setSelectedBranchId,
    toggleShowArchived: () => setShowArchived(!showArchived),
    toggleShowAllProjects: () => setShowAllProjects(!showAllProjects),
    toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
    showNotification,
    
    // View state
    readingDescriptionId, setReadingDescriptionId, 
    editingTask, setEditingTask, 
    readingTask, setReadingTask,
    remindingUserId, setRemindingUserId, 
    messageTemplates,
    updateMessageTemplates: (ts) => setMessageTemplates(p => ({ ...p, ...ts })),
    setAllBranchesCollapsed: (collapsed) => {
      setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const nextBranches = { ...p.branches };
        Object.keys(nextBranches).forEach(id => {
          nextBranches[id] = { ...nextBranches[id], collapsed };
        });
        return { ...p, branches: nextBranches };
      }));
    },

    // Global Workspace actions
    deleteProject: async (id) => { 
      if (confirm("Eliminare definitivamente questo progetto?")) {
        await dbService.deleteProject(id); 
        setProjects(p => p.filter(x => x.id !== id)); 
      }
    },
    closeProject: (id) => setProjects(p => p.filter(x => x.id !== id)),
    renameProject: (name) => actions.updateProject({ name }),
    loadProject: (ns, act = true) => { 
      setProjects(prev => [...prev.filter(x => x.id !== ns.id), ns]); 
      if (act) switchProject(ns.id); 
    },
    logout: async () => { 
      if (supabaseClient) await supabaseClient.auth.signOut(); 
      setSession(null); 
      window.location.reload(); 
    },
    enableOfflineMode: () => { 
      setIsOfflineMode(true); 
      localStorageService.saveOfflineMode(true); 
      window.location.reload(); 
    },
    disableOfflineMode: () => { 
      setIsOfflineMode(false); 
      localStorageService.saveOfflineMode(false); 
      window.location.reload(); 
    },

    // Cloud Specific
    uploadProjectToSupabase: async () => { 
      if (supabaseClient && session) await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id); 
    },
    downloadProjectFromSupabase: async (id) => { 
      if (supabaseClient) { 
        const p = await supabaseService.downloadFullProject(supabaseClient, id); 
        setProjects(prev => [...prev.filter(x => x.id !== id), p]); 
        switchProject(id); 
      } 
    },
    listProjectsFromSupabase: async () => supabaseClient ? (await supabaseService.fetchProjects(supabaseClient)).data || [] : [],
    deleteProjectFromSupabase: async (id) => { if (supabaseClient) await supabaseService.softDeleteProject(supabaseClient, id); },
    getProjectBranchesFromSupabase: async (id) => { if (supabaseClient) { const res = await supabaseService.fetchBranches(supabaseClient, id); return res.data || []; } return []; },
    moveLocalBranchToRemoteProject: async (bid, tid, tpid) => {
        // Logica specifica per spostamento tra database diversi (opzionale)
        showNotification("Spostamento remoto non ancora supportato nel refactoring.", "error");
    }
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
