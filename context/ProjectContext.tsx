
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
import { createInitialProjectState } from '../constants';
import { localStorageService } from '../services/localStorage';
import { supabaseService } from '../services/supabase';
import { dbService } from '../services/db';

export interface SyncStatus {
    dirtyCount: number;
    isSyncing: boolean;
}

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
  syncStatus: SyncStatus;
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;
  pendingSyncIds: Set<string>;

  setSupabaseConfig: (url: string, key: string) => void;
  switchProject: (id: string) => void;
  createProject: () => void;
  closeProject: (id: string) => void;
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
  moveBranch: (branchId: string, direction: 'up' | 'down') => void;
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

  syncDirtyRecords: () => Promise<void>;
  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (id: string, activate?: boolean, force?: boolean) => Promise<void>;
  listProjectsFromSupabase: () => Promise<any[]>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  getProjectBranchesFromSupabase: (projectId: string) => Promise<Branch[]>;
  moveLocalBranchToRemoteProject: (branchId: string, targetProjectId: string, targetParentId: string) => Promise<void>;

  logout: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;

  cleanupOldTasks: (months: number) => Promise<void>;
  checkProjectHealth: () => any;
  repairProjectStructure: () => void;
  resolveOrphans: (branchIds: string[]) => void;

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

const generateId = () => crypto.randomUUID();

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncingGlobal, setIsSyncingGlobal] = useState(false);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [supabaseConfig, setSupabaseConfigState] = useState(() => localStorageService.getSupabaseConfig());
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorageService.getOfflineMode());
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Modals state
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [messageTemplates, setMessageTemplates] = useState({ opening: "Ciao {name}, ecco i tuoi task:", closing: "Buon lavoro!" });

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  }, []);

  // Calcolo dei record "dirty"
  const syncStatus = useMemo(() => {
    let dirtyCount = 0;
    projects.forEach(p => {
        if (p.isDirty) dirtyCount++;
        p.people.forEach(pe => { if (pe.isDirty) dirtyCount++; });
        Object.values(p.branches).forEach(b => {
            if (b.isDirty) dirtyCount++;
            b.tasks.forEach(t => { if (t.isDirty) dirtyCount++; });
        });
    });
    return { dirtyCount, isSyncing: isSyncingGlobal };
  }, [projects, isSyncingGlobal]);

  // Sync singola entità
  const syncEntity = useCallback(async (table: string, payload: any): Promise<boolean> => {
      if (!supabaseClient || !session || isOfflineMode) return false;
      try {
          const { error } = await supabaseService.upsertEntity(supabaseClient, table, payload);
          if (error) {
              if (error.message === 'CONCURRENCY_CONFLICT') {
                  showNotification("Conflitto di versione. Ricarico dati...", "error");
                  return false;
              }
              throw error;
          }
          return true;
      } catch (e) {
          console.error("Sync error:", e);
          return false;
      }
  }, [supabaseClient, session, isOfflineMode, showNotification]);

  // Sincronizzazione di tutti i record Dirty
  const syncDirtyRecords = useCallback(async () => {
    if (!supabaseClient || !session || isOfflineMode || isSyncingGlobal) return;
    setIsSyncingGlobal(true);
    setAutoSaveStatus('saving');

    try {
        const nextProjects = [...projects];
        let anySuccess = false;

        for (const p of nextProjects) {
            // 1. Progetto
            if (p.isDirty) {
                const ok = await syncEntity('flowtask_projects', { id: p.id, name: p.name, root_branch_id: p.rootBranchId, version: p.version, owner_id: session.user.id });
                if (ok) { p.isDirty = false; p.version++; anySuccess = true; }
            }
            // 2. Persone
            for (const pe of p.people) {
                if (pe.isDirty) {
                    const ok = await syncEntity('flowtask_people', { ...pe, project_id: p.id });
                    if (ok) { pe.isDirty = false; pe.version++; anySuccess = true; }
                }
            }
            // 3. Rami e Task
            for (const b of Object.values(p.branches)) {
                if (b.isDirty) {
                    const ok = await syncEntity('flowtask_branches', { 
                        id: b.id, project_id: p.id, title: b.title, status: b.status, description: b.description,
                        start_date: b.startDate, due_date: b.dueDate, archived: b.archived, collapsed: b.collapsed,
                        parent_ids: b.parentIds, children_ids: b.childrenIds, responsible_id: b.responsibleId, version: b.version 
                    });
                    if (ok) { b.isDirty = false; b.version++; anySuccess = true; }
                }
                for (const t of b.tasks) {
                    if (t.isDirty) {
                        const ok = await syncEntity('flowtask_tasks', { 
                            id: t.id, branch_id: b.id, title: t.title, completed: t.completed, completed_at: t.completedAt,
                            assignee_id: t.assigneeId, due_date: t.dueDate, pinned: t.pinned, position: t.position, version: t.version 
                        });
                        if (ok) { t.isDirty = false; t.version++; anySuccess = true; }
                    }
                }
            }
        }

        if (anySuccess) {
            setProjects([...nextProjects]);
            setAutoSaveStatus('saved');
            setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } else {
            setAutoSaveStatus('idle');
        }
    } finally {
        setIsSyncingGlobal(false);
    }
  }, [projects, supabaseClient, session, isOfflineMode, isSyncingGlobal, syncEntity]);

  // Inizializzazione dati
  useEffect(() => {
    const init = async () => {
        try {
            await dbService.init();
            const stored = await dbService.getAllProjects();
            const activeId = await dbService.getSetting<string>('active_project_id');
            if (stored.length > 0) {
                setProjects(stored);
                setActiveProjectId(activeId && stored.some(x => x.id === activeId) ? activeId : stored[0].id);
            } else {
                const def = createInitialProjectState();
                setProjects([def]);
                setActiveProjectId(def.id);
            }
        } finally { setIsInitializing(false); }
    };
    init();
  }, []);

  // Salvataggio IndexedDB automatico
  useEffect(() => {
    if (!isInitializing) {
        dbService.setSetting('active_project_id', activeProjectId);
        projects.forEach(p => dbService.saveProject(p));
    }
  }, [projects, activeProjectId, isInitializing]);

  // Auto-sync periodico (ogni 30 secondi se ci sono dirty records)
  useEffect(() => {
    const timer = setInterval(() => {
        if (syncStatus.dirtyCount > 0 && !isSyncingGlobal) syncDirtyRecords();
    }, 30000);
    return () => clearInterval(timer);
  }, [syncStatus.dirtyCount, isSyncingGlobal, syncDirtyRecords]);

  // Auth Supabase
  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
        const client = createClient(supabaseConfig.url, supabaseConfig.key);
        setSupabaseClient(client);
        client.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingAuth(false); });
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription.unsubscribe();
    } else { setLoadingAuth(false); }
  }, [supabaseConfig]);

  // Azioni UI con Dirty Tracking
  const addBranch = useCallback((parentId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newId = generateId();
          const parent = p.branches[parentId];
          const newBranch: Branch = { 
              id: newId, title: 'Nuovo Ramo', status: BranchStatus.PLANNED, tasks: [], childrenIds: [], parentIds: [parentId], 
              version: 1, isDirty: true, updatedAt: new Date().toISOString() 
          };
          return {
              ...p,
              branches: {
                  ...p.branches,
                  [newId]: newBranch,
                  [parentId]: { ...parent, childrenIds: [...parent.childrenIds, newId], isDirty: true, updatedAt: new Date().toISOString() }
              }
          };
      }));
  }, [activeProjectId]);

  const updateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[branchId]) return p;
          const b = p.branches[branchId];
          return { ...p, branches: { ...p.branches, [branchId]: { ...b, ...updates, isDirty: true, updatedAt: new Date().toISOString() } } };
      }));
  }, [activeProjectId]);

  const addTask = useCallback((branchId: string, title: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId || !p.branches[branchId]) return p;
        const b = p.branches[branchId];
        const newId = generateId();
        const newTask: Task = { id: newId, title, completed: false, version: 1, isDirty: true, updatedAt: new Date().toISOString() };
        return { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: [...b.tasks, newTask], isDirty: true } } };
    }));
  }, [activeProjectId]);

  const updateTask = useCallback((branchId: string, taskId: string, updates: Partial<Task>) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId || !p.branches[branchId]) return p;
        const b = p.branches[branchId];
        const nextTasks = b.tasks.map(t => t.id === taskId ? { ...t, ...updates, isDirty: true, updatedAt: new Date().toISOString() } : t);
        return { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: nextTasks } } };
    }));
  }, [activeProjectId]);

  const deleteBranch = useCallback((bid: string) => {
    const b = activeProject.branches[bid];
    if (b && !isOfflineMode) syncEntity('flowtask_branches', { id: bid, deleted_at: new Date().toISOString(), version: b.version });
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const next = { ...p.branches };
        const target = next[bid];
        if (!target) return p;
        target.parentIds.forEach(pid => { if (next[pid]) next[pid].childrenIds = next[pid].childrenIds.filter(id => id !== bid); });
        delete next[bid];
        return { ...p, branches: next };
    }));
  }, [activeProjectId, activeProject, isOfflineMode, syncEntity]);

  const deleteTask = useCallback((bid: string, tid: string) => {
    const task = activeProject.branches[bid]?.tasks.find(x => x.id === tid);
    if (task && !isOfflineMode) syncEntity('flowtask_tasks', { id: tid, deleted_at: new Date().toISOString(), version: task.version });
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId || !p.branches[bid]) return p;
        const b = p.branches[bid];
        return { ...p, branches: { ...p.branches, [bid]: { ...b, tasks: b.tasks.filter(x => x.id !== tid) } } };
    }));
  }, [activeProjectId, activeProject, isOfflineMode, syncEntity]);

  const toggleBranchArchive = useCallback((branchId: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId || !p.branches[branchId]) return p;
        const b = p.branches[branchId];
        return { ...p, branches: { ...p.branches, [branchId]: { ...b, archived: !b.archived, isDirty: true, updatedAt: new Date().toISOString() } } };
    }));
  }, [activeProjectId]);

  const bulkUpdateTasks = useCallback((branchId: string, text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[branchId]) return p;
          const b = p.branches[branchId];
          const newTasks: Task[] = lines.map((lineTitle, idx) => ({
              id: generateId(),
              title: lineTitle,
              completed: false,
              version: 1,
              isDirty: true,
              position: idx,
              updatedAt: new Date().toISOString()
          }));
          return { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: newTasks, isDirty: true } } };
      }));
  }, [activeProjectId]);

  const bulkMoveTasks = useCallback((taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[sourceBranchId] || !p.branches[targetBranchId]) return p;
          const src = p.branches[sourceBranchId];
          const dst = p.branches[targetBranchId];
          const movingTasks = src.tasks.filter(t => taskIds.includes(t.id)).map(t => ({ ...t, isDirty: true }));
          return {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...src, tasks: src.tasks.filter(t => !taskIds.includes(t.id)), isDirty: true },
                  [targetBranchId]: { ...dst, tasks: [...dst.tasks, ...movingTasks], isDirty: true }
              }
          };
      }));
  }, [activeProjectId]);

  return (
    <ProjectContext.Provider value={{
      state: activeProject, projects, activeProjectId, selectedBranchId, showArchived, showAllProjects, showOnlyOpen,
      session, isOfflineMode, loadingAuth, isInitializing, autoSaveStatus, syncStatus, notification, supabaseConfig, supabaseClient,
      pendingSyncIds,
      setSupabaseConfig: (u, k) => { setSupabaseConfigState({url:u, key:k}); localStorageService.saveSupabaseConfig({url:u, key:k}); },
      switchProject: id => setActiveProjectId(id),
      createProject: () => { const np = createInitialProjectState('Nuovo Progetto ' + projects.length); setProjects([...projects, np]); setActiveProjectId(np.id); },
      closeProject: id => { setProjects(projects.filter(x => x.id !== id)); dbService.deleteProject(id); },
      renameProject: name => setProjects(projects.map(x => x.id === activeProjectId ? { ...x, name, isDirty: true, updatedAt: new Date().toISOString() } : x)),
      loadProject: (ns, act = true) => { setProjects(prev => [...prev.filter(x => x.id !== ns.id), ns]); if (act) setActiveProjectId(ns.id); },
      selectBranch: setSelectedBranchId,
      toggleShowArchived: () => setShowArchived(!showArchived),
      toggleShowAllProjects: () => setShowAllProjects(!showAllProjects),
      toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
      addBranch, updateBranch, deleteBranch,
      linkBranch: (cid, pid) => {
          setProjects(prev => prev.map(p => {
            if (p.id !== activeProjectId) return p;
            const child = p.branches[cid]; const parent = p.branches[pid];
            return { ...p, branches: { ...p.branches, [cid]: { ...child, parentIds: [...child.parentIds, pid], isDirty: true }, [pid]: { ...parent, childrenIds: [...parent.childrenIds, cid], isDirty: true } } };
          }));
      },
      unlinkBranch: (cid, pid) => {
          setProjects(prev => prev.map(p => {
            if (p.id !== activeProjectId) return p;
            const child = p.branches[cid]; const parent = p.branches[pid];
            return { ...p, branches: { ...p.branches, [cid]: { ...child, parentIds: child.parentIds.filter(x => x !== pid), isDirty: true }, [pid]: { ...parent, childrenIds: parent.childrenIds.filter(x => x !== cid), isDirty: true } } };
          }));
      },
      setAllBranchesCollapsed: c => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, branches: Object.fromEntries(Object.entries(p.branches).map(([k,v]) => [k, { ...v, collapsed: c }])) } : p)),
      moveBranch: (bid, dir) => { /* Mock implement */ },
      toggleBranchArchive,
      addTask, updateTask, deleteTask, moveTask: () => {},
      moveTaskToBranch: (tid, sbid, tbid) => {
          const task = activeProject.branches[sbid]?.tasks.find(x => x.id === tid);
          if (!task) return;
          setProjects(prev => prev.map(p => {
            if (p.id !== activeProjectId) return p;
            const src = p.branches[sbid]; const dst = p.branches[tbid];
            return { ...p, branches: { ...p.branches, [sbid]: { ...src, tasks: src.tasks.filter(x => x.id !== tid), isDirty: true }, [tbid]: { ...dst, tasks: [...dst.tasks, { ...task, isDirty: true }], isDirty: true } } };
          }));
      },
      bulkUpdateTasks,
      bulkMoveTasks,
      addPerson: (n, e, ph) => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, people: [...p.people, { id: generateId(), name: n, email: e, phone: ph, initials: n.slice(0,2).toUpperCase(), color: 'bg-indigo-500', version: 1, isDirty: true }], isDirty: true } : p)),
      updatePerson: (id, ups) => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, people: p.people.map(pe => pe.id === id ? { ...pe, ...ups, isDirty: true } : pe) } : p)),
      removePerson: id => {
          const person = activeProject.people.find(x => x.id === id);
          if (person && !isOfflineMode) syncEntity('flowtask_people', { id, deleted_at: new Date().toISOString(), version: person.version });
          setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, people: p.people.filter(x => x.id !== id) } : p));
      },
      syncDirtyRecords,
      uploadProjectToSupabase: async () => { if (supabaseClient && session) await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id); },
      downloadProjectFromSupabase: async (id) => { if (supabaseClient) { const p = await supabaseService.downloadFullProject(supabaseClient, id); setProjects(prev => [...prev.filter(x => x.id !== id), p]); setActiveProjectId(id); } },
      listProjectsFromSupabase: async () => supabaseClient ? (await supabaseService.fetchProjects(supabaseClient)).data || [] : [],
      deleteProjectFromSupabase: async id => { if (supabaseClient) await supabaseService.softDeleteProject(supabaseClient, id); },
      getProjectBranchesFromSupabase: async (pid) => { if (supabaseClient) { const res = await supabaseService.fetchBranches(supabaseClient, pid); return res.data || []; } return []; },
      moveLocalBranchToRemoteProject: async (bid, tpid, tparid) => { /* Mock implement */ },
      logout: async () => { if (supabaseClient) await supabaseClient.auth.signOut(); setSession(null); window.location.reload(); },
      enableOfflineMode: () => { setIsOfflineMode(true); localStorageService.saveOfflineMode(true); window.location.reload(); },
      disableOfflineMode: () => { setIsOfflineMode(false); localStorageService.saveOfflineMode(false); },
      showNotification,
      cleanupOldTasks: async (m) => { /* Mock implement */ },
      checkProjectHealth: () => ({ orphanedBranches: [] }),
      repairProjectStructure: () => { /* Mock implement */ },
      resolveOrphans: (ids) => { /* Mock implement */ },
      readingDescriptionId, setReadingDescriptionId, editingTask, setEditingTask, readingTask, setReadingTask, remindingUserId, setRemindingUserId, messageTemplates,
      updateMessageTemplates: ts => setMessageTemplates(p => ({ ...p, ...ts }))
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
