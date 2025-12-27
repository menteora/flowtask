
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
import { INITIAL_STATE, createInitialProjectState } from '../constants';

export interface OrphanInfo {
    id: string;
    title: string;
    status: BranchStatus;
    isLabel: boolean;
    taskCount: number;
    completedCount: number;
}

export interface ProjectHealthReport {
    legacyRootFound: boolean;
    missingRootNode: boolean;
    orphanedBranches: OrphanInfo[];
    totalIssues: number;
}

interface ProjectContextType {
  state: ProjectState;
  projects: ProjectState[];
  activeProjectId: string;
  selectedBranchId: string | null;
  showArchived: boolean;
  showAllProjects: boolean;
  showOnlyOpen: boolean;
  session: Session | null;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;

  setSupabaseConfig: (url: string, key: string) => void;
  switchProject: (id: string) => void;
  createProject: () => void;
  closeProject: (id: string) => void;
  renameProject: (name: string) => void;
  loadProject: (newState: ProjectState, activate?: boolean, removeDefault?: boolean) => void;
  selectBranch: (id: string | null) => void;
  toggleShowArchived: () => void;
  toggleShowAllProjects: () => void;
  toggleShowOnlyOpen: () => void;

  addBranch: (parentId: string) => void;
  updateBranch: (branchId: string, updates: Partial<Branch>) => void;
  deleteBranch: (branchId: string) => void;
  moveBranch: (branchId: string, direction: 'left' | 'right' | 'up' | 'down') => void;
  linkBranch: (childId: string, parentId: string) => void;
  unlinkBranch: (childId: string, parentId: string) => void;
  toggleBranchArchive: (branchId: string) => void;
  setAllBranchesCollapsed: (collapsed: boolean) => void;

  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToBranch: (taskId: string, sourceBranchId: string, targetBranchId: string) => void;
  bulkMoveTasks: (taskIds: string[], sourceBranchId: string, targetBranchId: string) => void;
  bulkUpdateTasks: (branchId: string, text: string) => void;
  cleanupOldTasks: (months: number) => Promise<{ count: number; backup: any[] }>;

  checkProjectHealth: () => ProjectHealthReport;
  repairProjectStructure: () => Promise<void>;
  resolveOrphans: (idsToFix: string[], idsToDelete: string[]) => void;

  addPerson: (name: string, email?: string, phone?: string) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;

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

  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (id: string, activate?: boolean, force?: boolean) => Promise<void>;
  listProjectsFromSupabase: () => Promise<any[]>;
  getProjectBranchesFromSupabase: (projectId: string) => Promise<Branch[]>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  moveLocalBranchToRemoteProject: (branchId: string, targetProjectId: string, targetParentId: string) => Promise<void>;

  logout: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectState[]>(() => {
    const saved = localStorage.getItem('flowtask_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved projects", e);
      }
    }
    return [createInitialProjectState()];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const savedId = localStorage.getItem('active_project_id');
    return savedId || (projects.length > 0 ? projects[0].id : '');
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showOnlyOpen, setShowOnlyOpen] = useState(() => {
    return localStorage.getItem('flowtask_show_only_open') === 'true';
  });
  
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [messageTemplates, setMessageTemplates] = useState({ 
      opening: "Ciao {name}, ecco un riepilogo dei tuoi task:", 
      closing: "Buon lavoro!" 
  });
  
  const [supabaseConfig, setSupabaseConfigState] = useState<{ url: string; key: string }>({ url: '', key: '' });
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const [remoteDataLoaded, setRemoteDataLoaded] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedProjectIdRef = useRef<string | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadProject = useCallback((newState: ProjectState, activate = true, removeDefault = false) => {
    setProjects(prev => {
        let next = [...prev];
        const existingIdx = next.findIndex(p => p.id === newState.id);
        if (existingIdx >= 0) {
            next[existingIdx] = newState;
        } else {
            next.push(newState);
        }
        if (removeDefault) {
            next = next.filter(p => p.id !== 'default-project');
        }
        return next;
    });
    if (activate) {
        setActiveProjectId(newState.id);
    }
  }, []);

  const downloadProjectFromSupabase = useCallback(async (id: string, activate = true, force = false) => {
      if (!supabaseClient || !session) return;
      
      try {
          const { data: projectData, error: pErr } = await supabaseClient.from('flowtask_projects').select('*').eq('id', id).single();
          if (pErr) throw pErr;
          if (!projectData) throw new Error("Progetto non trovato");

          const { data: peopleData, error: ppErr } = await supabaseClient.from('flowtask_people').select('*').eq('project_id', id);
          if (ppErr) throw ppErr;

          const { data: branchesData, error: bErr } = await supabaseClient.from('flowtask_branches').select('*').eq('project_id', id);
          if (bErr) throw bErr;

          const { data: tasksData, error: tErr } = await supabaseClient.from('flowtask_tasks').select('*').in('branch_id', branchesData?.map(b => b.id) || []);
          if (tErr) throw tErr;

          const people: Person[] = (peopleData || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              phone: p.phone,
              initials: p.initials,
              color: p.color
          }));

          const branches: Record<string, Branch> = {};
          (branchesData || []).forEach((b: any) => {
              const branchTasks = (tasksData || [])
                  .filter((t: any) => t.branch_id === b.id)
                  .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                  .map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    completed: t.completed,
                    completedAt: t.completed_at,
                    assigneeId: t.assignee_id,
                    dueDate: t.due_date,
                    pinned: t.pinned || false
                  }));

              branches[b.id] = {
                  id: b.id,
                  title: b.title,
                  description: b.description,
                  status: b.status as BranchStatus,
                  tasks: branchTasks,
                  childrenIds: b.children_ids || [],
                  parentIds: b.parent_ids || [],
                  startDate: b.start_date,
                  endDate: b.end_date,
                  dueDate: b.due_date,
                  archived: b.archived,
                  collapsed: b.collapsed,
                  isLabel: b.is_label
              };
          });

          const newState: ProjectState = {
              id: projectData.id,
              name: projectData.name,
              rootBranchId: projectData.root_branch_id,
              branches,
              people
          };

          loadProject(newState, activate, true); 
          lastSyncedProjectIdRef.current = id;
          setRemoteDataLoaded(true); 
      } catch (e: any) {
          console.error("Download Error:", e);
          if (force) showNotification("Errore nel download del progetto: " + e.message, 'error');
      }
  }, [supabaseClient, session, loadProject, showNotification]);

  const uploadProjectToSupabase = useCallback(async () => {
    if (!supabaseClient || !session || isOfflineMode) return;
    
    const projectToSave = projects.find(p => p.id === activeProjectId);
    if (!projectToSave || projectToSave.id === 'default-project') return;

    setAutoSaveStatus('saving');
    try {
        const { error: pErr } = await supabaseClient
            .from('flowtask_projects')
            .upsert({
                id: projectToSave.id,
                name: projectToSave.name,
                root_branch_id: projectToSave.rootBranchId,
                owner_id: session.user.id,
                created_at: new Date().toISOString()
            });
        if (pErr) throw pErr;

        const peoplePayload = projectToSave.people.map(p => ({
            id: p.id,
            project_id: projectToSave.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            initials: p.initials,
            color: p.color
        }));
        if (peoplePayload.length > 0) {
            const { error: ppErr } = await supabaseClient.from('flowtask_people').upsert(peoplePayload);
            if (ppErr) throw ppErr;
        }

        const branchesPayload = Object.values(projectToSave.branches).map((b: Branch) => ({
            id: b.id,
            project_id: projectToSave.id,
            title: b.title,
            description: b.description,
            status: b.status,
            start_date: b.startDate,
            end_date: b.endDate,
            due_date: b.dueDate,
            archived: b.archived,
            collapsed: b.collapsed,
            is_label: b.isLabel,
            parent_ids: b.parentIds,
            children_ids: b.childrenIds,
            position: 0
        }));
        if (branchesPayload.length > 0) {
            const { error: bErr } = await supabaseClient.from('flowtask_branches').upsert(branchesPayload);
            if (bErr) throw bErr;
        }

        const tasksPayload: any[] = [];
        Object.values(projectToSave.branches).forEach((b: Branch) => {
            b.tasks.forEach((t: Task, idx: number) => {
                tasksPayload.push({
                    id: t.id,
                    branch_id: b.id,
                    title: t.title,
                    description: t.description,
                    assignee_id: t.assigneeId,
                    due_date: t.dueDate,
                    completed: t.completed,
                    completed_at: t.completedAt,
                    position: idx,
                    pinned: t.pinned || false 
                });
            });
        });
        
        if (tasksPayload.length > 0) {
            const { error: tErr } = await supabaseClient.from('flowtask_tasks').upsert(tasksPayload);
            if (tErr) throw tErr;
        }

        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (e: any) {
        console.error("Sync Error:", e);
        setAutoSaveStatus('error');
    }
  }, [supabaseClient, session, isOfflineMode, projects, activeProjectId]);

  useEffect(() => {
    localStorage.setItem('flowtask_show_only_open', showOnlyOpen.toString());
  }, [showOnlyOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    let config = { url: '', key: '' };
    
    if (configParam) {
        try {
            config = JSON.parse(atob(configParam));
            window.history.replaceState({}, '', window.location.pathname); 
        } catch (e) { console.error("Invalid config param"); }
    } else {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) {
            try { config = JSON.parse(storedConfig); } catch(e) {}
        }
    }

    if (config.url && config.key) {
        setSupabaseConfigState(config);
    }

    setIsInitializing(false);
    setLoadingAuth(false); 
  }, []);

  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
        try {
            const client = createClient(supabaseConfig.url, supabaseConfig.key);
            setSupabaseClient(client);
            
            client.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setLoadingAuth(false);
            });

            const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
                setSession(session);
            });

            return () => subscription.unsubscribe();
        } catch (e) {
            console.error("Failed to initialize Supabase client", e);
            setLoadingAuth(false);
        }
    }
  }, [supabaseConfig]);

  useEffect(() => {
      const activeProject = projects.find(p => p.id === activeProjectId);
      if (session && !isOfflineMode && activeProjectId && activeProject && !activeProject.id.includes('default') && lastSyncedProjectIdRef.current !== activeProjectId) {
          setRemoteDataLoaded(false); 
          downloadProjectFromSupabase(activeProjectId, false, false)
             .then(() => setRemoteDataLoaded(true))
             .catch(err => console.error("Initial fetch failed", err));
      }
  }, [session, isOfflineMode, activeProjectId, downloadProjectFromSupabase]);

  useEffect(() => {
      localStorage.setItem('flowtask_projects', JSON.stringify(projects));
      localStorage.setItem('active_project_id', activeProjectId);
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  const setSupabaseConfig = (url: string, key: string) => {
      setSupabaseConfigState({ url, key });
      localStorage.setItem('supabase_config', JSON.stringify({ url, key }));
  };

  const updateMessageTemplates = (templates: Partial<{ opening: string; closing: string }>) => {
      setMessageTemplates(prev => ({ ...prev, ...templates }));
  };

  const switchProject = useCallback((id: string) => {
      setActiveProjectId(id);
      setSelectedBranchId(null);
  }, []);

  const createProject = useCallback(() => {
      const newProject = createInitialProjectState('Nuovo Progetto ' + (projects.length + 1));
      setProjects(prev => [...prev, newProject]);
      setActiveProjectId(newProject.id);
  }, [projects.length]);

  const closeProject = useCallback((id: string) => {
      setProjects(prev => {
          if (prev.length <= 1) return prev;
          const next = prev.filter(p => p.id !== id);
          if (activeProjectId === id) {
              setActiveProjectId(next[0].id);
          }
          return next;
      });
  }, [activeProjectId]);

  const renameProject = useCallback((name: string) => {
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, name } : p));
  }, [activeProjectId]);

  useEffect(() => {
      if (!session || isOfflineMode || isInitializing) return;
      if (session && !remoteDataLoaded) return;
      
      if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
          uploadProjectToSupabase();
      }, 2000);

      return () => {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      };
  }, [projects, session, isOfflineMode, isInitializing, uploadProjectToSupabase, remoteDataLoaded]);


  const listProjectsFromSupabase = useCallback(async () => {
      if (!supabaseClient) return [];
      const { data, error } = await supabaseClient.from('flowtask_projects').select('id, name, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  }, [supabaseClient]);

  const getProjectBranchesFromSupabase = useCallback(async (projectId: string) => {
      if (!supabaseClient) return [];
      const { data, error } = await supabaseClient.from('flowtask_branches').select('*').eq('project_id', projectId);
      if (error) throw error;
      return (data || []).map((b: any) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          childrenIds: b.children_ids || [],
          parentIds: b.parent_ids || [],
          tasks: [] 
      }));
  }, [supabaseClient]);

  const deleteProjectFromSupabase = useCallback(async (id: string) => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient.from('flowtask_projects').delete().eq('id', id);
      if (error) throw error;
  }, [supabaseClient]);

  const moveLocalBranchToRemoteProject = useCallback(async (branchId: string, targetProjectId: string, targetParentId: string) => {
      const sourceProject = projects.find(p => p.id === activeProjectId);
      const targetProject = projects.find(p => p.id === targetProjectId);
      if (!sourceProject || !targetProject) return;

      const branchToMove = sourceProject.branches[branchId];
      if (!branchToMove) return;

      // 1. Raccogli tutti i discendenti
      const descendantIds = new Set<string>();
      const queue = [branchId];
      while (queue.length > 0) {
          const cid = queue.shift()!;
          descendantIds.add(cid);
          sourceProject.branches[cid]?.childrenIds.forEach(id => queue.push(id));
      }

      // 2. Crea le strutture dati per il trasferimento
      const movedBranches: Record<string, Branch> = {};
      descendantIds.forEach(id => {
          const b = sourceProject.branches[id];
          if (b) {
              const movedB = { ...b };
              if (id === branchId) {
                  movedB.parentIds = [targetParentId];
              }
              movedBranches[id] = movedB;
          }
      });

      // 3. Aggiorna lo stato locale
      setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId) {
              const newBranches = { ...p.branches };
              // Rimuovi dai genitori originali
              branchToMove.parentIds.forEach(pid => {
                  if (newBranches[pid]) {
                      newBranches[pid] = { ...newBranches[pid], childrenIds: newBranches[pid].childrenIds.filter(id => id !== branchId) };
                  }
              });
              // Elimina rami
              descendantIds.forEach(id => delete newBranches[id]);
              return { ...p, branches: newBranches };
          }
          if (p.id === targetProjectId) {
              const newBranches = { ...p.branches, ...movedBranches };
              // Aggiungi al nuovo genitore
              if (newBranches[targetParentId]) {
                  newBranches[targetParentId] = { ...newBranches[targetParentId], childrenIds: [...newBranches[targetParentId].childrenIds, branchId] };
              }
              return { ...p, branches: newBranches };
          }
          return p;
      }));

      // 4. Sincronizzazione Supabase se attiva
      if (session && !isOfflineMode && supabaseClient) {
          try {
              // Sposta fisicamente i rami nel database aggiornando il project_id
              const { error } = await supabaseClient
                  .from('flowtask_branches')
                  .update({ project_id: targetProjectId })
                  .in('id', Array.from(descendantIds));
              
              if (error) throw error;

              // Aggiorna la gerarchia del ramo radice dello spostamento
              await supabaseClient
                  .from('flowtask_branches')
                  .update({ parent_ids: [targetParentId] })
                  .eq('id', branchId);

              showNotification("Spostamento completato con successo!", 'success');
          } catch (e: any) {
              console.error("Remote move error", e);
              showNotification("Errore durante lo spostamento remoto: " + e.message, 'error');
          }
      } else {
          showNotification("Spostamento locale completato.", 'success');
      }

      if (selectedBranchId === branchId) setSelectedBranchId(null);
  }, [activeProjectId, projects, session, isOfflineMode, supabaseClient, selectedBranchId, showNotification]);

  const toggleShowArchived = useCallback(() => {
    setShowArchived(prev => !prev);
  }, []);

  const toggleShowAllProjects = useCallback(() => {
    setShowAllProjects(prev => {
        const next = !prev;
        if (next && session && !isOfflineMode) {
            projects.forEach(p => {
                if (p.id !== activeProjectId) {
                    downloadProjectFromSupabase(p.id, false, false)
                        .catch(err => console.error(`Error syncing background project ${p.name}:`, err));
                }
            });
        }
        return next;
    });
  }, [projects, session, isOfflineMode, activeProjectId, downloadProjectFromSupabase]);

  const toggleShowOnlyOpen = useCallback(() => {
    setShowOnlyOpen(prev => !prev);
  }, []);

  const addBranch = useCallback((parentId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newId = crypto.randomUUID();
          const newBranch: Branch = {
              id: newId,
              title: 'Nuovo Ramo',
              status: BranchStatus.PLANNED,
              tasks: [],
              childrenIds: [],
              parentIds: [parentId],
              description: '',
              isLabel: false
          };
          
          const newBranches = { ...p.branches, [newId]: newBranch };
          if (newBranches[parentId]) {
              newBranches[parentId] = {
                  ...newBranches[parentId],
                  childrenIds: [...newBranches[parentId].childrenIds, newId]
              };
          }
          return { ...p, branches: newBranches };
      }));
  }, [activeProjectId]);

  const updateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          if (!p.branches[branchId]) return p;
          return {
              ...p,
              branches: {
                  ...p.branches,
                  [branchId]: { ...p.branches[branchId], ...updates }
              }
          };
      }));
  }, [activeProjectId]);

  const deleteBranch = useCallback(async (branchId: string) => {
      if (session && !isOfflineMode && supabaseClient) {
          supabaseClient.from('flowtask_branches').delete().eq('id', branchId).then(res => {
              if(res.error) console.error("Error deleting branch remote", res.error);
          });
      }

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newBranches = { ...p.branches };
          const branch = newBranches[branchId];
          if (!branch) return p;

          branch.parentIds.forEach(pid => {
              if (newBranches[pid]) {
                  newBranches[pid] = {
                      ...newBranches[pid],
                      childrenIds: newBranches[pid].childrenIds.filter(id => id !== branchId)
                  };
              }
          });

          delete newBranches[branchId];
          return { ...p, branches: newBranches };
      }));
      if (selectedBranchId === branchId) setSelectedBranchId(null);
  }, [activeProjectId, selectedBranchId, session, isOfflineMode, supabaseClient]);

  const moveBranch = useCallback((branchId: string, direction: 'left' | 'right' | 'up' | 'down') => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch || branch.parentIds.length === 0) return p;
          
          const parentId = branch.parentIds[0];
          const parent = p.branches[parentId];
          if (!parent) return p;

          const idx = parent.childrenIds.indexOf(branchId);
          if (idx === -1) return p;

          const newChildren = [...parent.childrenIds];
          let swapIdx = -1;
          
          if (direction === 'left' || direction === 'up') swapIdx = idx - 1;
          if (direction === 'right' || direction === 'down') swapIdx = idx + 1;

          if (swapIdx >= 0 && swapIdx < newChildren.length) {
              [newChildren[idx], newChildren[swapIdx]] = [newChildren[swapIdx], newChildren[idx]];
              return {
                  ...p,
                  branches: {
                      ...p.branches,
                      [parentId]: { ...parent, childrenIds: newChildren }
                  }
              };
          }
          return p;
      }));
  }, [activeProjectId]);

  const linkBranch = useCallback((childId: string, parentId: string) => {
       setProjects(prev => prev.map(p => {
           if (p.id !== activeProjectId) return p;
           const branches = { ...p.branches };
           if (branches[childId] && branches[parentId]) {
               if (!branches[childId].parentIds.includes(parentId)) {
                   branches[childId] = { ...branches[childId], parentIds: [...branches[childId].parentIds, parentId] };
                   branches[parentId] = { ...branches[parentId], childrenIds: [...branches[parentId].childrenIds, childId] };
               }
           }
           return { ...p, branches };
       }));
  }, [activeProjectId]);

  const unlinkBranch = useCallback((childId: string, parentId: string) => {
      setProjects(prev => prev.map(p => {
           if (p.id !== activeProjectId) return p;
           const branches = { ...p.branches };
           if (branches[childId] && branches[parentId]) {
               branches[childId] = { ...branches[childId], parentIds: branches[childId].parentIds.filter(id => id !== parentId) };
               branches[parentId] = { ...branches[parentId], childrenIds: branches[parentId].childrenIds.filter(id => id !== childId) };
           }
           return { ...p, branches };
      }));
  }, [activeProjectId]);

  const toggleBranchArchive = useCallback((branchId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          if (p.branches[branchId]) {
             const newVal = !p.branches[branchId].archived;
             return {
                 ...p,
                 branches: { ...p.branches, [branchId]: { ...p.branches[branchId], archived: newVal } }
             };
          }
          return p;
      }));
  }, [activeProjectId]);

  const setAllBranchesCollapsed = useCallback((collapsed: boolean) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newBranches = { ...p.branches };
          Object.keys(newBranches).forEach(id => {
              newBranches[id] = { ...newBranches[id], collapsed };
          });
          return { ...p, branches: newBranches };
      }));
  }, [activeProjectId]);

  const addTask = useCallback((branchId: string, title: string) => {
      if (!title.trim()) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;

          const newTask: Task = {
              id: crypto.randomUUID(),
              title,
              completed: false,
              description: '',
              pinned: false
          };
          return {
              ...p,
              branches: {
                  ...p.branches,
                  [branchId]: { ...branch, tasks: [...branch.tasks, newTask] }
              }
          };
      }));
  }, [activeProjectId]);

  const updateTask = useCallback((branchId: string, taskId: string, updates: Partial<Task>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p; 
          
          const branch = p.branches[branchId];
          if (!branch) return p;

          const newTasks = branch.tasks.map(t => {
              if (t.id === taskId) {
                  let completedAt = updates.completedAt !== undefined ? updates.completedAt : t.completedAt;
                  
                  if (updates.completed !== undefined && updates.completedAt === undefined) {
                      const becomingCompleted = updates.completed === true && t.completed === false;
                      const becomingOpen = updates.completed === false && t.completed === true;
                      
                      if (becomingCompleted) completedAt = new Date().toISOString();
                      else if (becomingOpen) completedAt = undefined;
                  }

                  return { ...t, ...updates, completedAt };
              }
              return t;
          });
          
          return {
              ...p,
              branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } }
          };
      }));
  }, [activeProjectId]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
      if (session && !isOfflineMode && supabaseClient) {
          supabaseClient.from('flowtask_tasks').delete().eq('id', taskId).then(res => {
              if(res.error) console.error("Error deleting task remote", res.error);
          });
      }

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;
          return {
              ...p,
              branches: { ...p.branches, [branchId]: { ...branch, tasks: branch.tasks.filter(t => t.id !== taskId) } }
          };
      }));
  }, [activeProjectId, session, isOfflineMode, supabaseClient]);

  const moveTask = useCallback((branchId: string, taskId: string, direction: 'up' | 'down') => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;
          const idx = branch.tasks.findIndex(t => t.id === taskId);
          if (idx === -1) return p;
          
          const newTasks = [...branch.tasks];
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
          
          if (swapIdx >= 0 && swapIdx < newTasks.length) {
              [newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx], newTasks[idx]];
              return {
                  ...p,
                  branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } }
              };
          }
          return p;
      }));
  }, [activeProjectId]);

  const moveTaskToBranch = useCallback((taskId: string, sourceBranchId: string, targetBranchId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const source = p.branches[sourceBranchId];
          const target = p.branches[targetBranchId];
          if (!source || !target) return p;

          const task = source.tasks.find(t => t.id === taskId);
          if (!task) return p;

          return {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...source, tasks: source.tasks.filter(t => t.id !== taskId) },
                  [targetBranchId]: { ...target, tasks: [...target.tasks, task] }
              }
          };
      }));
  }, [activeProjectId]);

  const bulkMoveTasks = useCallback((taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const source = p.branches[sourceBranchId];
          const target = p.branches[targetBranchId];
          if (!source || !target) return p;

          const tasksToMove = source.tasks.filter(t => taskIds.includes(t.id));
          const remainingTasks = source.tasks.filter(t => !taskIds.includes(t.id));

          return {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...source, tasks: remainingTasks },
                  [targetBranchId]: { ...target, tasks: [...target.tasks, ...tasksToMove] }
              }
          };
      }));
  }, [activeProjectId]);

  const bulkUpdateTasks = useCallback((branchId: string, text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      setProjects(prev => prev.map(p => {
           if (p.id !== activeProjectId) return p;
           const branch = p.branches[branchId];
           if (!branch) return p;
           
           const newTasks: Task[] = lines.map(line => {
               const existing = branch.tasks.find(t => t.title === line);
               return existing || { 
                   id: crypto.randomUUID(), 
                   title: line, 
                   completed: false, 
                   description: '', 
                   pinned: false 
               };
           });
           
           return {
               ...p,
               branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } }
           };
      }));
  }, [activeProjectId]);

  const cleanupOldTasks = useCallback(async (months: number): Promise<{ count: number; backup: any[] }> => {
      const threshold = new Date();
      threshold.setMonth(threshold.getMonth() - months);
      
      const backup: any[] = [];
      const idsToDelete: string[] = [];

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          
          const newBranches = { ...p.branches };
          Object.keys(newBranches).forEach(bid => {
              const b = newBranches[bid];
              const toRemove = b.tasks.filter(t => {
                  if (t.completed && t.completedAt) {
                      const cDate = new Date(t.completedAt);
                      return cDate < threshold;
                  }
                  return false;
              });

              if (toRemove.length > 0) {
                  toRemove.forEach(task => {
                      backup.push({ ...task, branchTitle: b.title, branchId: bid });
                      idsToDelete.push(task.id);
                  });
                  newBranches[bid] = {
                      ...b,
                      tasks: b.tasks.filter(t => !idsToDelete.includes(t.id))
                  };
              }
          });

          return { ...p, branches: newBranches };
      }));

      if (idsToDelete.length > 0 && supabaseClient && session && !isOfflineMode) {
          const { error } = await supabaseClient
              .from('flowtask_tasks')
              .delete()
              .in('id', idsToDelete);
          if (error) console.error("Remote cleanup error", error);
      }

      return { count: idsToDelete.length, backup };
  }, [activeProjectId, supabaseClient, session, isOfflineMode]);

  const checkProjectHealth = useCallback((): ProjectHealthReport => {
      const proj = activeProject;
      const report: ProjectHealthReport = {
          legacyRootFound: proj.rootBranchId === 'root' || !!proj.branches['root'],
          missingRootNode: !proj.branches[proj.rootBranchId],
          orphanedBranches: [],
          totalIssues: 0
      };

      const reachable = new Set<string>();
      if (!report.missingRootNode) {
          const queue = [proj.rootBranchId];
          reachable.add(proj.rootBranchId);
          
          while (queue.length > 0) {
              const currentId = queue.shift()!;
              const branch = proj.branches[currentId];
              if (branch) {
                  branch.childrenIds.forEach(cid => {
                      if (!reachable.has(cid) && proj.branches[cid]) {
                          reachable.add(cid);
                          queue.push(cid);
                      }
                  });
              }
          }
      }

      Object.keys(proj.branches).forEach(bid => {
          if (!reachable.has(bid)) {
              const b = proj.branches[bid];
              report.orphanedBranches.push({
                  id: bid,
                  title: b.title,
                  status: b.status,
                  isLabel: !!b.isLabel,
                  taskCount: b.tasks.length,
                  completedCount: b.tasks.filter(t => t.completed).length
              });
          }
      });

      report.totalIssues = (report.legacyRootFound ? 1 : 0) + (report.missingRootNode ? 1 : 0) + report.orphanedBranches.length;
      return report;
  }, [activeProject]);

  const repairProjectStructure = useCallback(async () => {
      let finalRootId = activeProject.rootBranchId;
      let finalBranches = { ...activeProject.branches };

      // 1. Identifica se c'è un problema di ID radice legacy o mancante
      if (finalBranches['root'] || finalRootId === 'root') {
          const oldRoot = finalBranches['root'] || finalBranches[finalRootId];
          const newRootId = crypto.randomUUID();
          
          if (oldRoot) {
              finalBranches[newRootId] = { 
                  ...oldRoot, 
                  id: newRootId,
                  parentIds: [] 
              };
              
              // Sposta i figli al nuovo ID radice
              if (oldRoot.childrenIds) {
                  oldRoot.childrenIds.forEach(cid => {
                      if (finalBranches[cid]) {
                          finalBranches[cid] = {
                              ...finalBranches[cid],
                              parentIds: (finalBranches[cid].parentIds || []).map(pid => pid === oldRoot.id || pid === 'root' ? newRootId : pid)
                          };
                      }
                  });
              }
              
              delete finalBranches['root'];
              if (finalRootId !== 'root') delete finalBranches[finalRootId];
              finalRootId = newRootId;
          }
      }

      // 2. Se ancora manca il nodo radice, crealo
      if (!finalBranches[finalRootId]) {
          finalBranches[finalRootId] = {
              id: finalRootId,
              title: 'Inizio Progetto (Ripristinato)',
              status: BranchStatus.PLANNED,
              isLabel: true,
              tasks: [],
              childrenIds: [],
              parentIds: [],
          };
      }

      // 3. Applica i cambiamenti locali
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { 
              ...p, 
              rootBranchId: finalRootId, 
              branches: finalBranches 
          };
      }));

      // 4. Se connesso al cloud, sincronizza immediatamente la radice per evitare discrepanze
      if (session && !isOfflineMode && supabaseClient) {
          try {
              setAutoSaveStatus('saving');
              const { error } = await supabaseClient
                  .from('flowtask_projects')
                  .update({ root_branch_id: finalRootId })
                  .eq('id', activeProjectId);
              
              if (error) throw error;
              
              // Carica i rami modificati (specialmente se l'ID è cambiato)
              await uploadProjectToSupabase(); 
              setAutoSaveStatus('saved');
              setTimeout(() => setAutoSaveStatus('idle'), 2000);
          } catch (e: any) {
              console.error("Remote root update error", e);
              setAutoSaveStatus('error');
              showNotification("Errore sincronizzazione radice remota.", 'error');
          }
      }

      showNotification("Integrità radice ripristinata.", 'success');
  }, [activeProjectId, activeProject, session, isOfflineMode, supabaseClient, uploadProjectToSupabase, showNotification]);

  const resolveOrphans = useCallback((idsToFix: string[], idsToDelete: string[]) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          
          let updatedBranches = { ...p.branches };
          const rootId = p.rootBranchId;

          idsToDelete.forEach(id => {
              delete updatedBranches[id];
          });

          idsToFix.forEach(id => {
              if (updatedBranches[id]) {
                  updatedBranches[id] = {
                      ...updatedBranches[id],
                      parentIds: [...new Set([...(updatedBranches[id].parentIds || []), rootId])]
                  };
                  if (updatedBranches[rootId]) {
                      updatedBranches[rootId] = {
                          ...updatedBranches[rootId],
                          childrenIds: [...new Set([...(updatedBranches[rootId].childrenIds || []), id])]
                      };
                  }
              }
          });

          return { ...p, branches: updatedBranches };
      }));
      showNotification(`${idsToFix.length} rami ripristinati e ${idsToDelete.length} eliminati.`, 'success');
  }, [activeProjectId, showNotification]);

  const addPerson = useCallback((name: string, email?: string, phone?: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newPerson: Person = {
              id: crypto.randomUUID(),
              name,
              email,
              phone,
              initials: name.substring(0, 2).toUpperCase(),
              color: 'bg-indigo-500' 
          };
          return { ...p, people: [...p.people, newPerson] };
      }));
  }, [activeProjectId]);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, people: p.people.map(person => person.id === id ? { ...person, ...updates } : person) };
      }));
  }, [activeProjectId]);

  const removePerson = useCallback(async (id: string) => {
      if (session && !isOfflineMode && supabaseClient) {
          supabaseClient.from('flowtask_people').delete().eq('id', id).then(res => {
              if(res.error) console.error("Error deleting person remote", res.error);
          });
      }

      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, people: p.people.filter(person => person.id !== id) };
      }));
  }, [activeProjectId, session, isOfflineMode, supabaseClient]);

  const logout = async () => {
      if (supabaseClient) await supabaseClient.auth.signOut();
      setSession(null);
  };
  
  const enableOfflineMode = () => setIsOfflineMode(true);
  const disableOfflineMode = () => setIsOfflineMode(false);

  return (
    <ProjectContext.Provider value={{
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
      
      setSupabaseConfig,
      switchProject,
      createProject,
      closeProject,
      renameProject,
      loadProject,
      selectBranch: setSelectedBranchId,
      toggleShowArchived,
      toggleShowAllProjects,
      toggleShowOnlyOpen,
      
      addBranch,
      updateBranch,
      deleteBranch,
      moveBranch,
      linkBranch,
      unlinkBranch,
      toggleBranchArchive,
      setAllBranchesCollapsed,
      
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      moveTaskToBranch,
      bulkMoveTasks,
      bulkUpdateTasks,
      cleanupOldTasks,

      checkProjectHealth,
      repairProjectStructure,
      resolveOrphans,
      
      addPerson,
      updatePerson,
      removePerson,
      
      readingDescriptionId,
      setReadingDescriptionId,
      editingTask,
      setEditingTask,
      readingTask,
      setReadingTask,
      remindingUserId,
      setRemindingUserId,
      
      messageTemplates,
      updateMessageTemplates,
      
      uploadProjectToSupabase,
      downloadProjectFromSupabase,
      listProjectsFromSupabase,
      getProjectBranchesFromSupabase,
      deleteProjectFromSupabase,
      moveLocalBranchToRemoteProject,
      
      logout,
      enableOfflineMode,
      disableOfflineMode,
      showNotification
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
