
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus, SyncOperation } from '../types';
import { createInitialProjectState } from '../constants';
import { localStorageService } from '../services/localStorage';
import { supabaseService } from '../services/supabase';
import { dbService } from '../services/db';
import { persistenceService } from '../services/persistence';

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

const generateId = () => crypto.randomUUID();

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

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
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());

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

  // Inizializzazione dati (IndexedDB)
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

  // Sync active project setting only
  useEffect(() => {
    if (!isInitializing) dbService.setSetting('active_project_id', activeProjectId);
  }, [activeProjectId, isInitializing]);

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

  // --- BACKGROUND SYNC ENGINE ---
  useEffect(() => {
    let isProcessing = false;
    const processQueue = async () => {
        if (isProcessing || isOfflineMode || !supabaseClient || !session) return;
        
        const queue = await dbService.getSyncQueue();
        if (queue.length === 0) {
            if (autoSaveStatus !== 'idle') setAutoSaveStatus('idle');
            return;
        }

        isProcessing = true;
        setAutoSaveStatus('saving');
        
        const currentBatchIds = new Set(queue.map(q => q.entityId));
        setPendingSyncIds(currentBatchIds);

        for (const op of queue) {
            try {
                let error;
                if (op.action === 'upsert') {
                    const res = await supabaseService.upsertEntity(supabaseClient, op.table, op.payload);
                    error = res.error;
                } else {
                    const deleteTableMap: Record<string, any> = {
                        flowtask_projects: supabaseService.softDeleteProject,
                        flowtask_branches: supabaseService.softDeleteBranch,
                        flowtask_tasks: supabaseService.softDeleteTask,
                        flowtask_people: supabaseService.softDeletePerson
                    };
                    const res = await deleteTableMap[op.table](supabaseClient, op.entityId);
                    error = res.error;
                }

                if (!error) {
                    await dbService.removeFromSyncQueue(op.id!);
                } else if (error.message === 'CONCURRENCY_CONFLICT') {
                    await dbService.removeFromSyncQueue(op.id!);
                    showNotification("Conflitto rilevato. Dati sincronizzati dal server.", "error");
                }
            } catch (e) {
                console.error("Sync error for operation", op, e);
            }
        }
        
        setPendingSyncIds(new Set());
        setAutoSaveStatus('saved');
        isProcessing = false;
    };

    const interval = setInterval(processQueue, 5000);
    return () => clearInterval(interval);
  }, [isOfflineMode, supabaseClient, session, autoSaveStatus, showNotification]);

  // --- AZIONI ---

  const addBranch = useCallback(async (parentId: string) => {
      const newId = generateId();
      const now = new Date().toISOString();
      let newBranch: Branch | null = null;

      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const parent = p.branches[parentId];
          newBranch = { 
              id: newId, title: 'Nuovo Ramo', status: BranchStatus.PLANNED, tasks: [], childrenIds: [], parentIds: [parentId], 
              version: 1, updatedAt: now 
          };
          const nextState = {
              ...p,
              branches: {
                  ...p.branches,
                  [newId]: newBranch,
                  [parentId]: { ...parent, childrenIds: [...parent.childrenIds, newId], updatedAt: now }
              }
          };
          persistenceService.saveBranch(p.id, newBranch!, isOfflineMode, supabaseClient, nextState);
          persistenceService.saveBranch(p.id, nextState.branches[parentId], isOfflineMode, supabaseClient, nextState);
          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const updateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const b = p.branches[branchId];
          const nextBranch = { ...b, ...updates, updatedAt: new Date().toISOString() };
          const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
          persistenceService.saveBranch(p.id, nextBranch, isOfflineMode, supabaseClient, nextState);
          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const toggleBranchArchive = useCallback((branchId: string) => {
      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const b = p.branches[branchId];
          const nextBranch = { ...b, archived: !b.archived, updatedAt: new Date().toISOString() };
          const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
          persistenceService.saveBranch(p.id, nextBranch, isOfflineMode, supabaseClient, nextState);
          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const addTask = useCallback((branchId: string, title: string) => {
    const newId = generateId();
    const now = new Date().toISOString();
    setProjects(prev => {
        const p = prev.find(x => x.id === activeProjectId)!;
        const b = p.branches[branchId];
        const newTask: Task = { id: newId, title, completed: false, version: 1, updatedAt: now, position: b.tasks.length };
        const nextBranch = { ...b, tasks: [...b.tasks, newTask] };
        const nextState = { ...p, branches: { ...p.branches, [branchId]: nextBranch } };
        persistenceService.saveTask(branchId, newTask, isOfflineMode, supabaseClient, nextState);
        return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const updateTask = useCallback((branchId: string, taskId: string, updates: Partial<Task>) => {
    setProjects(prev => {
        const p = prev.find(x => x.id === activeProjectId)!;
        const b = p.branches[branchId];
        const task = b.tasks.find(t => t.id === taskId)!;
        const nextTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
        const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: b.tasks.map(t => t.id === taskId ? nextTask : t) } } };
        persistenceService.saveTask(branchId, nextTask, isOfflineMode, supabaseClient, nextState);
        return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const moveTask = useCallback((branchId: string, taskId: string, direction: 'up' | 'down') => {
      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const b = p.branches[branchId];
          const newTasks = [...b.tasks];
          const idx = newTasks.findIndex(t => t.id === taskId);
          if (idx === -1) return prev;
          
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= newTasks.length) return prev;

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

          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const bulkUpdateTasks = useCallback((branchId: string, text: string) => {
      const titles = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      const now = new Date().toISOString();
      
      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const b = p.branches[branchId];
          
          // Tasks da mantenere/aggiornare e quelli da rimuovere
          const nextTasks: Task[] = [];
          const tasksToRemove = [...b.tasks];

          titles.forEach((title, index) => {
              const existingIdx = tasksToRemove.findIndex(t => t.title === title);
              if (existingIdx !== -1) {
                  // Trovato un task esistente con lo stesso titolo, lo manteniamo
                  const existing = tasksToRemove.splice(existingIdx, 1)[0];
                  nextTasks.push({ ...existing, position: index, updatedAt: now });
              } else {
                  // Nuovo task
                  nextTasks.push({ id: generateId(), title, completed: false, version: 1, updatedAt: now, position: index });
              }
          });

          const nextState = { ...p, branches: { ...p.branches, [branchId]: { ...b, tasks: nextTasks } } };
          
          // 1. Sincronizza le rimozioni (quelle rimaste in tasksToRemove non erano nella nuova lista)
          tasksToRemove.forEach(t => {
              persistenceService.deleteTask(t.id, isOfflineMode, supabaseClient, nextState);
          });

          // 2. Sincronizza aggiunte o aggiornamenti di posizione
          nextTasks.forEach(t => {
              persistenceService.saveTask(branchId, t, isOfflineMode, supabaseClient, nextState);
          });

          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const bulkMoveTasks = useCallback((taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      setProjects(prev => {
          const p = prev.find(x => x.id === activeProjectId)!;
          const source = p.branches[sourceBranchId];
          const target = p.branches[targetBranchId];
          
          const movedTasks = source.tasks.filter(t => taskIds.includes(t.id));
          const remainingTasks = source.tasks.filter(t => !taskIds.includes(t.id));
          
          const nextState = {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...source, tasks: remainingTasks },
                  [targetBranchId]: { ...target, tasks: [...target.tasks, ...movedTasks] }
              }
          };

          movedTasks.forEach(t => {
              persistenceService.saveTask(targetBranchId, t, isOfflineMode, supabaseClient, nextState);
          });

          return prev.map(x => x.id === activeProjectId ? nextState : x);
      });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const deleteBranch = useCallback((bid: string) => {
    setProjects(prev => {
        const p = prev.find(x => x.id === activeProjectId)!;
        const target = p.branches[bid];
        if (!target) return prev;
        const nextBranches = { ...p.branches };
        target.parentIds.forEach(pid => { if (nextBranches[pid]) nextBranches[pid] = { ...nextBranches[pid], childrenIds: nextBranches[pid].childrenIds.filter(id => id !== bid) }; });
        delete nextBranches[bid];
        const nextState = { ...p, branches: nextBranches };
        persistenceService.deleteBranch(bid, isOfflineMode, supabaseClient, nextState);
        return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const deleteTask = useCallback((bid: string, tid: string) => {
    setProjects(prev => {
        const p = prev.find(x => x.id === activeProjectId)!;
        const b = p.branches[bid];
        const nextState = { ...p, branches: { ...p.branches, [bid]: { ...b, tasks: b.tasks.filter(x => x.id !== tid) } } };
        persistenceService.deleteTask(tid, isOfflineMode, supabaseClient, nextState);
        return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  }, [activeProjectId, isOfflineMode, supabaseClient]);

  const addPerson = (n: string, e?: string, ph?: string) => {
    const newId = generateId();
    setProjects(prev => {
      const p = prev.find(x => x.id === activeProjectId)!;
      const newPerson: Person = { id: newId, name: n, email: e, phone: ph, initials: n.slice(0,2).toUpperCase(), color: 'bg-indigo-500', version: 1 };
      const nextState = { ...p, people: [...p.people, newPerson] };
      persistenceService.savePerson(p.id, newPerson, isOfflineMode, supabaseClient, nextState);
      return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  };

  const updatePerson = (id: string, updates: Partial<Person>) => {
    setProjects(prev => {
        const p = prev.find(x => x.id === activeProjectId)!;
        const person = p.people.find(pe => pe.id === id)!;
        const nextPerson = { ...person, ...updates, updatedAt: new Date().toISOString() };
        const nextState = { ...p, people: p.people.map(pe => pe.id === id ? nextPerson : pe) };
        persistenceService.savePerson(p.id, nextPerson, isOfflineMode, supabaseClient, nextState);
        return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  };

  const removePerson = (id: string) => {
    setProjects(prev => {
      const p = prev.find(x => x.id === activeProjectId)!;
      const nextState = { ...p, people: p.people.filter(x => x.id !== id) };
      persistenceService.deletePerson(id, isOfflineMode, supabaseClient, nextState);
      return prev.map(x => x.id === activeProjectId ? nextState : x);
    });
  };

  return (
    <ProjectContext.Provider value={{
      state: activeProject, projects, activeProjectId, selectedBranchId, showArchived, showAllProjects, showOnlyOpen,
      session, isOfflineMode, loadingAuth, isInitializing, autoSaveStatus, notification, supabaseConfig, supabaseClient,
      pendingSyncIds,
      setSupabaseConfig: (u, k) => { setSupabaseConfigState({url:u, key:k}); localStorageService.saveSupabaseConfig({url:u, key:k}); },
      switchProject: id => setActiveProjectId(id),
      createProject: () => { const np = createInitialProjectState(); setProjects([...projects, np]); setActiveProjectId(np.id); if(isOfflineMode) dbService.saveProject(np); },
      closeProject: id => { setProjects(projects.filter(x => x.id !== id)); dbService.deleteProject(id); },
      renameProject: name => {
          setProjects(prev => {
              const nextState = { ...prev.find(x => x.id === activeProjectId)!, name };
              persistenceService.saveProject(nextState, isOfflineMode, supabaseClient);
              return prev.map(x => x.id === activeProjectId ? nextState : x);
          });
      },
      loadProject: (ns, act = true) => { setProjects(prev => [...prev.filter(x => x.id !== ns.id), ns]); if (act) setActiveProjectId(ns.id); },
      selectBranch: setSelectedBranchId,
      toggleShowArchived: () => setShowArchived(!showArchived),
      toggleShowAllProjects: () => setShowAllProjects(!showAllProjects),
      toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
      addBranch, updateBranch, deleteBranch, toggleBranchArchive,
      linkBranch: (cid, pid) => {
          setProjects(prev => {
            const p = prev.find(x => x.id === activeProjectId)!;
            const child = p.branches[cid]; const parent = p.branches[pid];
            const nextState = { ...p, branches: { ...p.branches, [cid]: { ...child, parentIds: [...child.parentIds, pid] }, [pid]: { ...parent, childrenIds: [...parent.childrenIds, cid] } } };
            persistenceService.saveBranch(p.id, nextState.branches[cid], isOfflineMode, supabaseClient, nextState);
            persistenceService.saveBranch(p.id, nextState.branches[pid], isOfflineMode, supabaseClient, nextState);
            return prev.map(x => x.id === activeProjectId ? nextState : x);
          });
      },
      unlinkBranch: (cid, pid) => {
          setProjects(prev => {
            const p = prev.find(x => x.id === activeProjectId)!;
            const child = p.branches[cid]; const parent = p.branches[pid];
            const nextState = { ...p, branches: { ...p.branches, [cid]: { ...child, parentIds: child.parentIds.filter(x => x !== pid) }, [pid]: { ...parent, childrenIds: parent.childrenIds.filter(x => x !== cid) } } };
            persistenceService.saveBranch(p.id, nextState.branches[cid], isOfflineMode, supabaseClient, nextState);
            persistenceService.saveBranch(p.id, nextState.branches[pid], isOfflineMode, supabaseClient, nextState);
            return prev.map(x => x.id === activeProjectId ? nextState : x);
          });
      },
      setAllBranchesCollapsed: c => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, branches: Object.fromEntries(Object.entries(p.branches).map(([k,v]) => [k, { ...(v as Branch), collapsed: c }])) } : p)),
      addTask, updateTask, deleteTask, moveTask, bulkUpdateTasks, bulkMoveTasks,
      moveTaskToBranch: (tid, sbid, tbid) => {
          setProjects(prev => {
            const p = prev.find(x => x.id === activeProjectId)!;
            const task = p.branches[sbid]?.tasks.find(x => x.id === tid)!;
            const nextState = { ...p, branches: { ...p.branches, [sbid]: { ...p.branches[sbid], tasks: p.branches[sbid].tasks.filter(x => x.id !== tid) }, [tbid]: { ...p.branches[tbid], tasks: [...p.branches[tbid].tasks, task] } } };
            persistenceService.saveTask(tbid, task, isOfflineMode, supabaseClient, nextState);
            return prev.map(x => x.id === activeProjectId ? nextState : x);
          });
      },
      addPerson, updatePerson, removePerson,
      uploadProjectToSupabase: async () => { if (supabaseClient && session) await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id); },
      downloadProjectFromSupabase: async (id) => { if (supabaseClient) { const p = await supabaseService.downloadFullProject(supabaseClient, id); setProjects(prev => [...prev.filter(x => x.id !== id), p]); setActiveProjectId(id); } },
      listProjectsFromSupabase: async () => supabaseClient ? (await supabaseService.fetchProjects(supabaseClient)).data || [] : [],
      getProjectBranchesFromSupabase: async (id) => { if (supabaseClient) { const res = await supabaseService.fetchBranches(supabaseClient, id); return res.data || []; } return []; },
      moveLocalBranchToRemoteProject: async (bid, tid, tpid) => {
          const branch = activeProject.branches[bid];
          if (!branch || isOfflineMode || !supabaseClient) return;
          // Operazione sincrona via sync_queue
          await dbService.addToSyncQueue({
              entityId: bid,
              table: 'flowtask_branches',
              action: 'upsert',
              payload: { ...branch, project_id: tid, parent_ids: [tpid] },
              timestamp: Date.now()
          });
          deleteBranch(bid);
          showNotification("Spostamento ramo accodato per la sincronizzazione.", "success");
      },
      logout: async () => { if (supabaseClient) await supabaseClient.auth.signOut(); setSession(null); window.location.reload(); },
      enableOfflineMode: () => { setIsOfflineMode(true); localStorageService.saveOfflineMode(true); window.location.reload(); },
      disableOfflineMode: () => { setIsOfflineMode(false); localStorageService.saveOfflineMode(false); window.location.reload(); },
      showNotification,
      readingDescriptionId, setReadingDescriptionId, editingTask, setEditingTask, readingTask, setReadingTask, remindingUserId, setRemindingUserId, messageTemplates,
      updateMessageTemplates: (ts: Partial<{ opening: string; closing: string }>) => setMessageTemplates(p => ({ ...p, ...ts }))
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
