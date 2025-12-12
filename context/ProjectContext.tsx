import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ProjectState, Branch, BranchStatus, Task, Person } from '../types';
import { INITIAL_STATE } from '../constants';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Helper for IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

interface ProjectContextType {
  state: ProjectState; // The CURRENTLY ACTIVE project state
  
  // Tab Management
  projects: ProjectState[];
  activeProjectId: string;
  createProject: () => void;
  closeProject: (id: string) => void;
  switchProject: (id: string) => void;
  renameProject: (name: string) => void;

  // Actions (apply to active project)
  loadProject: (newState: ProjectState, activate?: boolean, removeDefault?: boolean) => void;
  addBranch: (parentId: string) => void;
  updateBranch: (branchId: string, data: Partial<Omit<Branch, 'id' | 'childrenIds' | 'tasks'>>) => void;
  linkBranch: (childId: string, parentId: string) => void;
  unlinkBranch: (childId: string, parentId: string) => void;
  deleteBranch: (branchId: string) => void;
  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, data: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  bulkUpdateTasks: (branchId: string, rawText: string) => void;
  addPerson: (name: string, email: string) => void;
  updatePerson: (id: string, data: Partial<Person>) => void;
  removePerson: (id: string) => void;
  
  selectedBranchId: string | null;
  selectBranch: (id: string | null) => void;
  toggleBranchArchive: (branchId: string) => void;
  showArchived: boolean;
  toggleShowArchived: () => void;

  // Supabase & Auth
  supabaseConfig: { url: string; key: string };
  setSupabaseConfig: (url: string, key: string) => void;
  supabaseClient: SupabaseClient | null;
  session: Session | null;
  loadingAuth: boolean;
  isOfflineMode: boolean;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  
  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (projectId: string, activate?: boolean, removeDefault?: boolean) => Promise<void>;
  listProjectsFromSupabase: () => Promise<Array<{ id: string, name: string, updated_at: string }>>;
  logout: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // We manage an array of projects
  const [projects, setProjects] = useState<ProjectState[]>([INITIAL_STATE]);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_STATE.id);
  
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Supabase State
  const [supabaseConfig, setSupabaseState] = useState<{ url: string; key: string }>({
      url: localStorage.getItem('supabase_url') || '',
      key: localStorage.getItem('supabase_key') || ''
  });
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const enableOfflineMode = useCallback(() => setIsOfflineMode(true), []);
  const disableOfflineMode = useCallback(() => setIsOfflineMode(false), []);

  // Initialize Client when config changes
  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
        try {
            const client = createClient(supabaseConfig.url, supabaseConfig.key);
            setSupabaseClient(client);
            
            // Check session
            setLoadingAuth(true);
            client.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setLoadingAuth(false);
            });

            // Listen for changes
            const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
                setSession(session);
            });

            return () => subscription.unsubscribe();
        } catch (e) {
            console.error("Invalid Supabase Config", e);
            setLoadingAuth(false);
        }
    } else {
        setSupabaseClient(null);
        setSession(null);
    }
  }, [supabaseConfig.url, supabaseConfig.key]);

  const setSupabaseConfig = (url: string, key: string) => {
      localStorage.setItem('supabase_url', url);
      localStorage.setItem('supabase_key', key);
      setSupabaseState({ url, key });
  };

  const logout = async () => {
      if (supabaseClient) {
          await supabaseClient.auth.signOut();
          setSession(null);
      }
  };

  // Helper to get active project (or default if something goes wrong)
  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || INITIAL_STATE;

  // Helper to update the ACTIVE project specifically
  const setProjectState = useCallback((updateFn: (prev: ProjectState) => ProjectState) => {
    setProjects(prevProjects => {
      return prevProjects.map(p => {
        if (p.id === activeProjectId) {
          return updateFn(p);
        }
        return p;
      });
    });
  }, [activeProjectId]);

  // --- Tab Management ---

  const createProject = useCallback(() => {
    const newId = generateId();
    const newProject: ProjectState = {
      ...INITIAL_STATE,
      id: newId,
      name: `Nuovo Progetto ${projects.length + 1}`,
      branches: { ...INITIAL_STATE.branches }, // Shallow copy isn't enough for deep objects, but keys are primitives. 
      // Deep copy branches to avoid reference issues
      // Simplifying deep copy for initial state:
      people: [...INITIAL_STATE.people]
    };
    
    // Deep Clone branches for the new project to avoid shared references with INITIAL_STATE
    newProject.branches = JSON.parse(JSON.stringify(INITIAL_STATE.branches));

    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newId);
    setSelectedBranchId(null);
  }, [projects.length]);

  const closeProject = useCallback((id: string) => {
    setProjects(prev => {
      if (prev.length <= 1) {
        // Don't close the last project, just reset it maybe? Or do nothing.
        // Let's prevent closing the last tab for simplicity
        // alert("Impossibile chiudere l'ultimo progetto attivo.");
        return prev;
      }
      
      const newProjects = prev.filter(p => p.id !== id);
      
      // If we closed the active project, switch to the last available
      if (id === activeProjectId) {
        setActiveProjectId(newProjects[newProjects.length - 1].id);
        setSelectedBranchId(null);
      }
      
      return newProjects;
    });
  }, [activeProjectId]);

  const switchProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setSelectedBranchId(null);
  }, []);

  const renameProject = useCallback((name: string) => {
    setProjectState(prev => ({ ...prev, name }));
  }, [setProjectState]);


  // --- Logic ---

  const toggleShowArchived = useCallback(() => {
    setShowArchived(prev => !prev);
  }, []);

  const loadProject = useCallback((newState: ProjectState, activate = true, removeDefault = false) => {
    if (!newState.branches || !newState.rootBranchId) {
        console.error("File JSON non valido o corrotto.");
        return;
    }
    
    // Ensure the imported project has an ID and Name
    const projectId = newState.id || generateId();
    const projectName = newState.name || 'Progetto Importato';

    const projectToLoad: ProjectState = {
        ...newState,
        id: projectId,
        name: projectName
    };

    setProjects(prev => {
        let currentProjects = prev;
        
        // Remove the default sample project if requested (e.g., on first cloud sync)
        if (removeDefault) {
            currentProjects = prev.filter(p => p.id !== 'default-project');
        }

        // If ID exists, update it. Otherwise add new.
        const exists = currentProjects.some(p => p.id === projectId);
        if (exists) {
            return currentProjects.map(p => p.id === projectId ? projectToLoad : p);
        }
        return [...currentProjects, projectToLoad];
    });

    if (activate) {
        setActiveProjectId(projectId);
        setSelectedBranchId(null);
    }
  }, []);

  const addBranch = useCallback((parentId: string) => {
    const newId = generateId();
    const newBranch: Branch = {
      id: newId,
      title: 'Nuovo Ramo',
      status: BranchStatus.PLANNED, 
      tasks: [],
      childrenIds: [],
      parentIds: [parentId],
      archived: false
    };

    setProjectState(prev => {
      const parent = prev.branches[parentId];
      if (!parent) return prev;

      return {
        ...prev,
        branches: {
          ...prev.branches,
          [parentId]: {
            ...parent,
            childrenIds: [...parent.childrenIds, newId],
          },
          [newId]: newBranch,
        },
      };
    });
  }, [setProjectState]);

  const updateBranch = useCallback((branchId: string, data: Partial<Omit<Branch, 'id' | 'childrenIds' | 'tasks'>>) => {
    setProjectState(prev => {
      const currentBranch = prev.branches[branchId];
      if (!currentBranch) return prev;

      const updates = { ...data };
      
      const now = new Date();
      const localToday = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

      if (data.status) {
        if (data.status === BranchStatus.ACTIVE && !currentBranch.startDate && !data.startDate) {
          updates.startDate = localToday;
        }
        if ((data.status === BranchStatus.CLOSED || data.status === BranchStatus.CANCELLED) && !currentBranch.endDate && !data.endDate) {
          updates.endDate = localToday;
        }
      }

      return {
        ...prev,
        branches: {
          ...prev.branches,
          [branchId]: { ...currentBranch, ...updates },
        },
      };
    });
  }, [setProjectState]);

  const toggleBranchArchive = useCallback((branchId: string) => {
    setProjectState(prev => {
          const current = prev.branches[branchId];
          if (!current) return prev;
          return {
              ...prev,
              branches: {
                  ...prev.branches,
                  [branchId]: { ...current, archived: !current.archived }
              }
          }
      })
  }, [setProjectState]);

  const isAncestor = (branches: Record<string, Branch>, childId: string, potentialAncestorId: string): boolean => {
      if (childId === potentialAncestorId) return true;
      const child = branches[childId];
      if (!child || child.parentIds.length === 0) return false;
      
      for (const pid of child.parentIds) {
          if (pid === potentialAncestorId) return true;
          if (isAncestor(branches, pid, potentialAncestorId)) return true;
      }
      return false;
  };

  const linkBranch = useCallback((childId: string, parentId: string) => {
    setProjectState(prev => {
        const child = prev.branches[childId];
        const parent = prev.branches[parentId];

        if (!child || !parent || childId === parentId || child.parentIds.includes(parentId)) {
            return prev;
        }

        if (isAncestor(prev.branches, parentId, childId)) {
            alert("Operazione non consentita: creerebbe un ciclo infinito.");
            return prev;
        }

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [parentId]: {
                    ...parent,
                    childrenIds: [...parent.childrenIds, childId]
                },
                [childId]: {
                    ...child,
                    parentIds: [...child.parentIds, parentId]
                }
            }
        };
    });
  }, [setProjectState]);

  const unlinkBranch = useCallback((childId: string, parentId: string) => {
    setProjectState(prev => {
        const child = prev.branches[childId];
        const parent = prev.branches[parentId];
        
        if (!child || !parent) return prev;

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [parentId]: {
                    ...parent,
                    childrenIds: parent.childrenIds.filter(id => id !== childId)
                },
                [childId]: {
                    ...child,
                    parentIds: child.parentIds.filter(id => id !== parentId)
                }
            }
        };
      });
  }, [setProjectState]);

  const deleteBranch = useCallback((branchId: string) => {
    setProjectState(prev => {
      const branchToDelete = prev.branches[branchId];
      if (!branchToDelete) return prev; 
      
      const newBranches = { ...prev.branches };

      branchToDelete.parentIds.forEach(pid => {
          if (newBranches[pid]) {
              newBranches[pid] = {
                  ...newBranches[pid],
                  childrenIds: newBranches[pid].childrenIds.filter(id => id !== branchId)
              };
          }
      });

      branchToDelete.childrenIds.forEach(cid => {
          if (newBranches[cid]) {
              newBranches[cid] = {
                  ...newBranches[cid],
                  parentIds: newBranches[cid].parentIds.filter(id => id !== branchId)
              };
          }
      });

      delete newBranches[branchId];

      return {
        ...prev,
        branches: newBranches,
      };
    });

    if (selectedBranchId === branchId) {
        setSelectedBranchId(null);
    }
  }, [selectedBranchId, setProjectState]);

  const addTask = useCallback((branchId: string, title: string) => {
    if (!title.trim()) return;
    const newTask: Task = {
      id: generateId(),
      title: title.trim(),
      completed: false,
    };

    setProjectState(prev => ({
      ...prev,
      branches: {
        ...prev.branches,
        [branchId]: {
          ...prev.branches[branchId],
          tasks: [...prev.branches[branchId].tasks, newTask],
        },
      },
    }));
  }, [setProjectState]);

  const updateTask = useCallback((branchId: string, taskId: string, data: Partial<Task>) => {
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;
        
        const newTasks = branch.tasks.map(t => t.id === taskId ? { ...t, ...data } : t);
        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: { ...branch, tasks: newTasks }
            }
        };
    });
  }, [setProjectState]);

  const deleteTask = useCallback((branchId: string, taskId: string) => {
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;

        const newTasks = branch.tasks.filter(t => t.id !== taskId);
        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: { ...branch, tasks: newTasks }
            }
        };
    });
  }, [setProjectState]);

  const bulkUpdateTasks = useCallback((branchId: string, rawText: string) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;

        const currentTasksMap = new Map(branch.tasks.map(t => [t.title, t]));
        
        const newTasks: Task[] = lines.map(line => {
            if (currentTasksMap.has(line)) {
                return currentTasksMap.get(line)!;
            }
            return {
                id: generateId(),
                title: line,
                completed: false
            };
        });

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: { ...branch, tasks: newTasks }
            }
        };
    });
  }, [setProjectState]);

  const addPerson = useCallback((name: string, email: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    const newPerson: Person = {
        id: generateId(),
        name,
        email,
        initials,
        color: randomColor
    };
    
    setProjectState(prev => ({
        ...prev,
        people: [...prev.people, newPerson]
    }));
  }, [setProjectState]);

  const updatePerson = useCallback((id: string, data: Partial<Person>) => {
    setProjectState(prev => {
        const current = prev.people.find(p => p.id === id);
        if (!current) return prev;

        let updates = { ...data };
        
        // Recalculate initials if name changes
        if (data.name) {
             updates.initials = data.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }

        return {
            ...prev,
            people: prev.people.map(p => p.id === id ? { ...p, ...updates } : p)
        };
    });
  }, [setProjectState]);

  const removePerson = useCallback((id: string) => {
    setProjectState(prev => ({
        ...prev,
        people: prev.people.filter(p => p.id !== id)
    }));
  }, [setProjectState]);

  // --- SUPABASE INTEGRATION ---

  const uploadProjectToSupabase = useCallback(async () => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");
    
    const p = activeProject;
    
    // 0. Get user ID (optional but recommended for RLS)
    const { data: { user } } = await supabaseClient.auth.getUser();

    // 1. Save Project
    const { error: pError } = await supabaseClient.from('flowtask_projects').upsert({
        id: p.id,
        name: p.name,
        owner_id: user?.id, // Link to auth user
        created_at: new Date().toISOString()
    });
    if (pError) throw pError;

    // 2. Save People
    if (p.people.length > 0) {
        const peopleData = p.people.map(person => ({
            id: person.id,
            project_id: p.id,
            name: person.name,
            email: person.email,
            initials: person.initials,
            color: person.color
        }));
        const { error: ppError } = await supabaseClient.from('flowtask_people').upsert(peopleData);
        if (ppError) throw ppError;
    }

    // 3. Save Branches (Flattened)
    const branches = Object.values(p.branches);
    if (branches.length > 0) {
        const branchesData = branches.map(b => ({
            id: b.id,
            project_id: p.id,
            title: b.title,
            description: b.description,
            status: b.status,
            start_date: b.startDate,
            end_date: b.endDate,
            due_date: b.dueDate,
            archived: b.archived || false,
            parent_ids: b.parentIds,
            children_ids: b.childrenIds
        }));
        const { error: bError } = await supabaseClient.from('flowtask_branches').upsert(branchesData);
        if (bError) throw bError;
    }

    // 4. Save Tasks (Flattened)
    const tasks = branches.flatMap(b => b.tasks.map(t => ({
        id: t.id,
        branch_id: b.id, // Link to branch
        title: t.title,
        assignee_id: t.assigneeId,
        due_date: t.dueDate,
        completed: t.completed
    })));

    if (tasks.length > 0) {
        const { error: tError } = await supabaseClient.from('flowtask_tasks').upsert(tasks);
        if (tError) throw tError;
    }
  }, [supabaseClient, activeProject]);

  const listProjectsFromSupabase = useCallback(async () => {
      if (!supabaseClient) throw new Error("Client Supabase non inizializzato");

      const { data, error } = await supabaseClient.from('flowtask_projects').select('id, name, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  }, [supabaseClient]);

  const downloadProjectFromSupabase = useCallback(async (projectId: string, activate = true, removeDefault = false) => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");

    // 1. Fetch Project Info
    const { data: projectData, error: pError } = await supabaseClient.from('flowtask_projects').select('*').eq('id', projectId).single();
    if (pError) throw pError;

    // 2. Fetch People
    const { data: peopleData, error: ppError } = await supabaseClient.from('flowtask_people').select('*').eq('project_id', projectId);
    if (ppError) throw ppError;

    // 3. Fetch Branches
    const { data: branchesData, error: bError } = await supabaseClient.from('flowtask_branches').select('*').eq('project_id', projectId);
    if (bError) throw bError;

    // 4. Fetch Tasks (For all branches in this project)
    const branchIds = branchesData.map((b: any) => b.id);
    // If no branches, no tasks
    let tasksData: any[] = [];
    if (branchIds.length > 0) {
        const { data: tData, error: tError } = await supabaseClient.from('flowtask_tasks').select('*').in('branch_id', branchIds);
        if (tError) throw tError;
        tasksData = tData || [];
    }

    // --- RECONSTRUCT STATE ---
    
    // Map People
    const people: Person[] = peopleData.map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        initials: p.initials,
        color: p.color
    }));

    // Map Tasks grouped by Branch ID
    const tasksByBranch: Record<string, Task[]> = {};
    tasksData.forEach((t: any) => {
        if (!tasksByBranch[t.branch_id]) tasksByBranch[t.branch_id] = [];
        tasksByBranch[t.branch_id].push({
            id: t.id,
            title: t.title,
            assigneeId: t.assignee_id,
            dueDate: t.due_date,
            completed: t.completed
        });
    });

    // Map Branches
    const branches: Record<string, Branch> = {};
    let rootBranchId = 'root'; // Fallback
    
    branchesData.forEach((b: any) => {
        branches[b.id] = {
            id: b.id,
            title: b.title,
            description: b.description,
            status: b.status as BranchStatus,
            startDate: b.start_date,
            endDate: b.end_date,
            dueDate: b.due_date,
            tasks: tasksByBranch[b.id] || [],
            childrenIds: b.children_ids || [],
            parentIds: b.parent_ids || [],
            archived: b.archived
        };
        
        if (b.parent_ids.length === 0) rootBranchId = b.id;
    });
    
    if (branches['root']) rootBranchId = 'root';

    const newState: ProjectState = {
        id: projectData.id,
        name: projectData.name,
        people: people,
        branches: branches,
        rootBranchId: rootBranchId
    };

    loadProject(newState, activate, removeDefault);
  }, [supabaseClient, loadProject]);

  // AUTO SYNC EFFECT
  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
        if (session && supabaseClient && !isOfflineMode) {
            try {
                const list = await listProjectsFromSupabase();
                if (list && list.length > 0 && isMounted) {
                    // Download the most recent one (index 0) and activate it.
                    // IMPORTANT: Pass removeDefault = true to wipe the "Sample Project" 
                    // if it is the only one present.
                    await downloadProjectFromSupabase(list[0].id, true, true);
                    
                    // Download others silently (background)
                    const others = list.slice(1);
                    if (others.length > 0) {
                        await Promise.all(others.map(p => downloadProjectFromSupabase(p.id, false, false)));
                    }
                }
            } catch (e) {
                console.error("Auto-sync failed", e);
            }
        }
    };
    
    // We run this when session becomes available.
    // NOTE: This might run on every session refresh token update if not careful, 
    // but React's ref comparison on session object usually handles it if reference is stable or we check ID.
    // For simplicity, we rely on the session existence check.
    if (session?.user?.id) {
         sync();
    }
    
    return () => { isMounted = false; };
  }, [session?.user?.id, supabaseClient, isOfflineMode, listProjectsFromSupabase, downloadProjectFromSupabase]);

  return (
    <ProjectContext.Provider value={{
      state: activeProject, // Expose only the active project so components don't break
      projects,
      activeProjectId,
      createProject,
      closeProject,
      switchProject,
      renameProject,
      
      loadProject,
      addBranch,
      updateBranch,
      linkBranch,
      unlinkBranch,
      deleteBranch,
      addTask,
      updateTask,
      deleteTask,
      bulkUpdateTasks,
      addPerson,
      updatePerson,
      removePerson,
      selectedBranchId,
      selectBranch: setSelectedBranchId,
      toggleBranchArchive,
      showArchived,
      toggleShowArchived,

      supabaseConfig,
      supabaseClient,
      session,
      loadingAuth,
      isOfflineMode,
      enableOfflineMode,
      disableOfflineMode,
      setSupabaseConfig,
      uploadProjectToSupabase,
      downloadProjectFromSupabase,
      listProjectsFromSupabase,
      logout
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