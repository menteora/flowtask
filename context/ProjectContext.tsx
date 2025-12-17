import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
import { INITIAL_STATE } from '../constants';

interface ProjectContextType {
  state: ProjectState;
  projects: ProjectState[];
  activeProjectId: string;
  selectedBranchId: string | null;
  showArchived: boolean;
  showAllProjects: boolean;
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

  addBranch: (parentId: string) => void;
  updateBranch: (branchId: string, updates: Partial<Branch>) => void;
  deleteBranch: (branchId: string) => void;
  moveBranch: (branchId: string, direction: 'left' | 'right' | 'up' | 'down') => void;
  linkBranch: (childId: string, parentId: string) => void;
  unlinkBranch: (childId: string, parentId: string) => void;
  toggleBranchArchive: (branchId: string) => void;

  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToBranch: (taskId: string, sourceBranchId: string, targetBranchId: string) => void;
  bulkUpdateTasks: (branchId: string, text: string) => void;

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
  // State
  const [projects, setProjects] = useState<ProjectState[]>([INITIAL_STATE]);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_STATE.id);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  
  // UI State
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settings
  const [messageTemplates, setMessageTemplates] = useState({ 
      opening: "Ciao {name}, ecco un riepilogo dei tuoi task:", 
      closing: "Buon lavoro!" 
  });
  
  // Supabase / Auth
  const [supabaseConfig, setSupabaseConfigState] = useState<{ url: string; key: string }>({ url: '', key: '' });
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialization
  useEffect(() => {
    // Load config from local storage or URL params
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    let config = { url: '', key: '' };
    
    if (configParam) {
        try {
            config = JSON.parse(atob(configParam));
            window.history.replaceState({}, '', window.location.pathname); // Clean URL
        } catch (e) { console.error("Invalid config param"); }
    } else {
        const storedConfig = localStorage.getItem('supabase_config');
        if (storedConfig) config = JSON.parse(storedConfig);
    }

    if (config.url && config.key) {
        setSupabaseConfigState(config);
    }
    
    // Load local projects
    const savedProjects = localStorage.getItem('flowtask_projects');
    if (savedProjects) {
        try {
            setProjects(JSON.parse(savedProjects));
        } catch (e) { console.error("Error loading local projects", e); }
    }
    
    const savedActiveId = localStorage.getItem('active_project_id');
    if (savedActiveId) setActiveProjectId(savedActiveId);

    setIsInitializing(false);
    setLoadingAuth(false); // Assume done for local part
  }, []);

  // Initialize Supabase Client
  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
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
    }
  }, [supabaseConfig]);

  // Persistence (Auto-save local)
  useEffect(() => {
      localStorage.setItem('flowtask_projects', JSON.stringify(projects));
      localStorage.setItem('active_project_id', activeProjectId);
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Helpers
  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const setSupabaseConfig = (url: string, key: string) => {
      setSupabaseConfigState({ url, key });
      localStorage.setItem('supabase_config', JSON.stringify({ url, key }));
  };

  const updateMessageTemplates = (templates: Partial<{ opening: string; closing: string }>) => {
      setMessageTemplates(prev => ({ ...prev, ...templates }));
  };

  // --- Logic Functions ---

  const switchProject = useCallback((id: string) => {
      setActiveProjectId(id);
      setSelectedBranchId(null);
  }, []);

  const createProject = useCallback(() => {
      const newProject: ProjectState = {
          ...INITIAL_STATE,
          id: crypto.randomUUID(),
          name: 'Nuovo Progetto ' + (projects.length + 1),
          branches: {
              'root': { ...INITIAL_STATE.branches['root'], id: 'root' } // Ensure root exists
          }
      };
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

  // --- CLOUD SYNC IMPLEMENTATION ---

  const uploadProjectToSupabase = useCallback(async () => {
      if (!supabaseClient || !session || isOfflineMode) return;
      
      const projectToSave = projects.find(p => p.id === activeProjectId);
      if (!projectToSave || projectToSave.id === 'default-project') return;

      setAutoSaveStatus('saving');
      try {
          // 1. Upsert Project
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

          // 2. Prepare & Upsert People
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

          // 3. Prepare & Upsert Branches
          const branchesPayload = Object.values(projectToSave.branches).map(b => ({
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

          // 4. Prepare & Upsert Tasks
          const tasksPayload: any[] = [];
          Object.values(projectToSave.branches).forEach(b => {
              b.tasks.forEach((t, idx) => {
                  tasksPayload.push({
                      id: t.id,
                      branch_id: b.id,
                      title: t.title,
                      description: t.description,
                      assignee_id: t.assigneeId,
                      due_date: t.dueDate,
                      completed: t.completed,
                      position: idx,
                      pinned: t.pinned || false // Explicitly save pinned state
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
          // Only show toast on manual fail, silent fail for auto-save usually better unless critical
      }
  }, [supabaseClient, session, isOfflineMode, projects, activeProjectId]);

  // Auto-Save Effect
  useEffect(() => {
      if (!session || isOfflineMode || isInitializing) return;
      
      // Clear existing timer
      if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer (Debounce 2s)
      autoSaveTimerRef.current = setTimeout(() => {
          uploadProjectToSupabase();
      }, 2000);

      return () => {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      };
  }, [projects, session, isOfflineMode, isInitializing, uploadProjectToSupabase]);


  const downloadProjectFromSupabase = useCallback(async (id: string, activate = true, force = false) => {
      if (!supabaseClient || !session) return;
      
      try {
          // Fetch Data
          const { data: projectData, error: pErr } = await supabaseClient.from('flowtask_projects').select('*').eq('id', id).single();
          if (pErr) throw pErr;

          const { data: peopleData, error: ppErr } = await supabaseClient.from('flowtask_people').select('*').eq('project_id', id);
          if (ppErr) throw ppErr;

          const { data: branchesData, error: bErr } = await supabaseClient.from('flowtask_branches').select('*').eq('project_id', id);
          if (bErr) throw bErr;

          const { data: tasksData, error: tErr } = await supabaseClient.from('flowtask_tasks').select('*').in('branch_id', branchesData?.map(b => b.id) || []);
          if (tErr) throw tErr;

          // Reconstruct State
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

          loadProject(newState, activate, true); // true to remove default project if it exists
      } catch (e: any) {
          console.error("Download Error:", e);
          showNotification("Errore nel download del progetto: " + e.message, 'error');
      }
  }, [supabaseClient, session]);

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
      return data.map((b: any) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          childrenIds: b.children_ids || [],
          parentIds: b.parent_ids || [],
          tasks: [] // Lightweight for selection
      }));
  }, [supabaseClient]);

  const deleteProjectFromSupabase = useCallback(async (id: string) => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient.from('flowtask_projects').delete().eq('id', id);
      if (error) throw error;
  }, [supabaseClient]);

  const moveLocalBranchToRemoteProject = useCallback(async (branchId: string, targetProjectId: string, targetParentId: string) => {
      // Stub implementation for complex feature - requires transactional logic
      // For now, this is a placeholder as requested by the initial prompt context
      console.warn("Cross-project move not fully implemented in this version.");
  }, []);

  // ---

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

  // Branch Logic
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
      // Remote Delete (Fire & Forget)
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

          // Remove from parents
          branch.parentIds.forEach(pid => {
              if (newBranches[pid]) {
                  newBranches[pid] = {
                      ...newBranches[pid],
                      childrenIds: newBranches[pid].childrenIds.filter(id => id !== branchId)
                  };
              }
          });

          // Remove self
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

  // Task Logic
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
          const newTasks = branch.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
          return {
              ...p,
              branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } }
          };
      }));
  }, [activeProjectId]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
      // Remote Delete
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

  const bulkUpdateTasks = useCallback((branchId: string, text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      setProjects(prev => prev.map(p => {
           if (p.id !== activeProjectId) return p;
           const branch = p.branches[branchId];
           if (!branch) return p;
           
           const newTasks: Task[] = lines.map(line => {
               const existing = branch.tasks.find(t => t.title === line);
               return existing || { id: crypto.randomUUID(), title: line, completed: false, description: '', pinned: false };
           });
           
           return {
               ...p,
               branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } }
           };
      }));
  }, [activeProjectId]);

  // People Logic
  const addPerson = useCallback((name: string, email?: string, phone?: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const newPerson: Person = {
              id: crypto.randomUUID(),
              name,
              email,
              phone,
              initials: name.substring(0, 2).toUpperCase(),
              color: 'bg-indigo-500' // Simple default
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
      // Remote Delete
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
      
      addBranch,
      updateBranch,
      deleteBranch,
      moveBranch,
      linkBranch,
      unlinkBranch,
      toggleBranchArchive,
      
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      moveTaskToBranch,
      bulkUpdateTasks,
      
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
