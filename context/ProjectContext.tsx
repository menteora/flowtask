import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ProjectState, Branch, BranchStatus, Task, Person } from '../types';
import { INITIAL_STATE } from '../constants';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Helper for IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

interface Notification {
    message: string;
    type: 'success' | 'error';
}

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
  moveBranch: (branchId: string, direction: 'left' | 'right') => void;
  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, data: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  bulkUpdateTasks: (branchId: string, rawText: string) => void;
  addPerson: (name: string, email: string, phone: string) => void;
  updatePerson: (id: string, data: Partial<Person>) => void;
  removePerson: (id: string) => void;
  
  selectedBranchId: string | null;
  selectBranch: (id: string | null) => void;
  
  // Reading Mode State
  readingDescriptionId: string | null;
  setReadingDescriptionId: (id: string | null) => void;

  // Task Editing State (Global Modal)
  editingTask: { branchId: string, taskId: string } | null;
  setEditingTask: (data: { branchId: string, taskId: string } | null) => void;

  // Reminding User State (Global Modal)
  remindingUserId: string | null;
  setRemindingUserId: (id: string | null) => void;

  toggleBranchArchive: (branchId: string) => void;
  showArchived: boolean;
  toggleShowArchived: () => void;

  // Supabase & Auth
  supabaseConfig: { url: string; key: string };
  setSupabaseConfig: (url: string, key: string) => void;
  supabaseClient: SupabaseClient | null;
  session: Session | null;
  loadingAuth: boolean;
  isInitializing: boolean; // New state
  isOfflineMode: boolean;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  
  uploadProjectToSupabase: () => Promise<void>;
  downloadProjectFromSupabase: (projectId: string, activate?: boolean, removeDefault?: boolean) => Promise<void>;
  deleteProjectFromSupabase: (projectId: string) => Promise<void>;
  listProjectsFromSupabase: () => Promise<Array<{ id: string, name: string, updated_at: string }>>;
  getProjectBranchesFromSupabase: (projectId: string) => Promise<Branch[]>;
  moveLocalBranchToRemoteProject: (branchIdToMove: string, targetProjectId: string, targetParentId: string) => Promise<void>;
  logout: () => Promise<void>;
  
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  
  // Global Notification
  notification: Notification | null;
  showNotification: (message: string, type: 'success' | 'error') => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // We manage an array of projects
  // Initialize from LocalStorage if available
  const [projects, setProjects] = useState<ProjectState[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('flowtask_projects');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.error("Failed to parse saved projects", e);
            }
        }
    }
    
    // Generate a unique root ID for the default project to avoid collisions
    const defaultRootId = generateId();
    const defaultProject: ProjectState = {
        ...INITIAL_STATE,
        id: generateId(),
        rootBranchId: defaultRootId,
        branches: {
            [defaultRootId]: {
                ...INITIAL_STATE.branches['root'],
                id: defaultRootId,
                isLabel: true // Default to Label
            }
        }
    };
    return [defaultProject];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          // 1. Try to get specific last active project
          const lastActiveId = localStorage.getItem('flowtask_active_project_id');
          if (lastActiveId && projects.some(p => p.id === lastActiveId)) {
              return lastActiveId;
          }

          // 2. Fallback to first project in saved list
          const saved = localStorage.getItem('flowtask_projects');
          if (saved) {
               try {
                   const parsed = JSON.parse(saved);
                   if (Array.isArray(parsed) && parsed.length > 0) {
                       return parsed[0].id;
                   }
               } catch (e) {}
          }
      }
      return projects.length > 0 ? projects[0].id : '';
  });
  
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ branchId: string, taskId: string } | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Notification State
  const [notification, setNotification] = useState<Notification | null>(null);
  
  // Auto-save Status
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Flag to prevent auto-save loops when loading data from cloud
  const isRemoteUpdate = useRef(false);

  // Supabase State
  const [supabaseConfig, setSupabaseState] = useState<{ url: string; key: string }>({
      url: localStorage.getItem('supabase_url') || '',
      key: localStorage.getItem('supabase_key') || ''
  });
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Start true to block UI
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // PERSISTENCE: Save projects to localStorage whenever they change
  useEffect(() => {
      localStorage.setItem('flowtask_projects', JSON.stringify(projects));
  }, [projects]);

  // PERSISTENCE: Save active project ID whenever it changes
  useEffect(() => {
      if (activeProjectId) {
          localStorage.setItem('flowtask_active_project_id', activeProjectId);
      }
  }, [activeProjectId]);

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  }, []);

  const enableOfflineMode = useCallback(() => {
      setIsOfflineMode(true);
      setIsInitializing(false);
  }, []);
  
  const disableOfflineMode = useCallback(() => {
      setIsOfflineMode(false);
      // If we disable offline mode, we might want to re-init, 
      // but usually the auth flow takes over.
  }, []);

  // Check URL for shared config on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedConfig = params.get('config');
    
    if (encodedConfig) {
        try {
            const decoded = atob(encodedConfig);
            const config = JSON.parse(decoded);
            if (config.url && config.key) {
                setSupabaseState({ url: config.url, key: config.key });
                localStorage.setItem('supabase_url', config.url);
                localStorage.setItem('supabase_key', config.key);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (e) {
            console.error("Failed to parse shared config", e);
        }
    }
  }, []);

  // Initialize Client when config changes
  useEffect(() => {
    const hasConfig = supabaseConfig.url && supabaseConfig.key;

    if (hasConfig) {
        try {
            const client = createClient(supabaseConfig.url, supabaseConfig.key);
            setSupabaseClient(client);
            
            // Start loading Auth
            setLoadingAuth(true);
            setIsInitializing(true); // Ensure spinner is shown while checking auth
            
            client.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
                setLoadingAuth(false);
                
                // CRITICAL FIX: If no session, we are done initializing (show Login).
                // If there IS a session, the Sync Effect will handle turning off isInitializing
                // after data load to prevent dummy data flash.
                if (!session) {
                    setIsInitializing(false);
                }
            });

            // Listen for changes
            const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
                setSession(session);
                if (_event === 'SIGNED_OUT') {
                    setIsInitializing(false);
                }
            });

            return () => subscription.unsubscribe();
        } catch (e) {
            console.error("Invalid Supabase Config", e);
            setLoadingAuth(false);
            setIsInitializing(false); // Stop waiting if config is bad
        }
    } else {
        setSupabaseClient(null);
        setSession(null);
        setLoadingAuth(false);
        // If no config, we are initialized (ready to show Config screen)
        setIsInitializing(false);
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
          setIsOfflineMode(false);
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
    const newProjectId = generateId();
    const newRootId = generateId();

    const newProject: ProjectState = {
      id: newProjectId,
      name: `Nuovo Progetto ${projects.length + 1}`,
      rootBranchId: newRootId,
      people: [...INITIAL_STATE.people],
      branches: {
          [newRootId]: {
              id: newRootId,
              title: 'Inizio Progetto',
              description: 'Punto di partenza del flusso',
              status: BranchStatus.PLANNED,
              isLabel: true, // Default to Label
              tasks: [],
              childrenIds: [],
              parentIds: [],
              position: 0
          }
      }
    };

    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProjectId);
    setSelectedBranchId(null);
  }, [projects.length]);

  const closeProject = useCallback((id: string) => {
    setProjects(prev => {
      if (prev.length <= 1) {
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
        showNotification("File JSON non valido o corrotto.", 'error');
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
  }, [showNotification]);

  const addBranch = useCallback((parentId: string) => {
    const newId = generateId();
    const newBranch: Branch = {
      id: newId,
      title: 'Nuovo Ramo',
      status: BranchStatus.PLANNED, 
      tasks: [],
      childrenIds: [],
      parentIds: [parentId],
      archived: false,
      position: 0
    };

    setProjectState(prev => {
      const parent = prev.branches[parentId];
      if (!parent) return prev;

      return {
        ...prev,
        branches: {
          ...prev.branches,
          [parentId]: Object.assign({}, parent, {
            childrenIds: [...parent.childrenIds, newId],
          }),
          [newId]: newBranch,
        },
      };
    });
  }, [setProjectState]);

  const updateBranch = useCallback((branchId: string, data: Partial<Omit<Branch, 'id' | 'childrenIds' | 'tasks'>>) => {
    setProjectState(prev => {
      const currentBranch = prev.branches[branchId];
      if (!currentBranch) return prev;

      // USE Object.assign instead of spread to avoid potential spread type errors
      const updates = Object.assign({}, data);
      
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
          [branchId]: Object.assign({}, currentBranch, updates),
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
                  [branchId]: Object.assign({}, current, { archived: !current.archived })
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
            showNotification("Operazione non consentita: creerebbe un ciclo infinito.", 'error');
            return prev;
        }

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [parentId]: Object.assign({}, parent, {
                    childrenIds: [...parent.childrenIds, childId]
                }),
                [childId]: Object.assign({}, child, {
                    parentIds: [...child.parentIds, parentId]
                })
            }
        };
    });
  }, [setProjectState, showNotification]);

  const unlinkBranch = useCallback((childId: string, parentId: string) => {
    const child = activeProject.branches[childId];
    if (child) {
        if (child.parentIds.length <= 1 && child.parentIds.includes(parentId)) {
            showNotification("Impossibile scollegare: un ramo deve avere almeno un genitore per non rimanere orfano.", 'error');
            return;
        }
    }

    setProjectState(prev => {
        const child = prev.branches[childId];
        const parent = prev.branches[parentId];
        
        if (!child || !parent) return prev;

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [parentId]: Object.assign({}, parent, {
                    childrenIds: parent.childrenIds.filter(id => id !== childId)
                }),
                [childId]: Object.assign({}, child, {
                    parentIds: child.parentIds.filter(id => id !== parentId)
                })
            }
        };
      });
  }, [setProjectState, activeProject, showNotification]);

  const deleteBranch = useCallback((branchId: string) => {
    setProjectState(prev => {
      const branchToDelete = prev.branches[branchId];
      if (!branchToDelete) return prev; 
      
      // Prevent deleting Root, though UI should handle this
      if (branchId === prev.rootBranchId) {
          showNotification("Non puoi eliminare il ramo radice del progetto.", 'error');
          return prev;
      }

      const newBranches = { ...prev.branches };
      const parentIds = branchToDelete.parentIds;
      const childrenIds = branchToDelete.childrenIds;

      // 1. RE-LINK ORPHANS (Children)
      childrenIds.forEach(childId => {
          if (newBranches[childId]) {
              const currentParents = newBranches[childId].parentIds.filter(id => id !== branchId);
              const newParents = Array.from(new Set([...currentParents, ...parentIds]));
              
              newBranches[childId] = {
                  ...newBranches[childId],
                  parentIds: newParents
              };
          }
      });

      // 2. UPDATE PARENTS
      parentIds.forEach(parentId => {
          if (newBranches[parentId]) {
              const currentChildren = newBranches[parentId].childrenIds.filter(id => id !== branchId);
              const newChildren = Array.from(new Set([...currentChildren, ...childrenIds]));

              newBranches[parentId] = {
                  ...newBranches[parentId],
                  childrenIds: newChildren
              };
          }
      });

      // 3. DELETE
      delete newBranches[branchId];

      return {
        ...prev,
        branches: newBranches,
      };
    });

    if (selectedBranchId === branchId) {
        setSelectedBranchId(null);
    }
  }, [selectedBranchId, setProjectState, showNotification]);

  const moveBranch = useCallback((branchId: string, direction: 'left' | 'right') => {
    setProjectState(prev => {
      const branch = prev.branches[branchId];
      // Can't move root or orphans easily without parent ref
      if (!branch || branch.parentIds.length === 0) return prev;

      const newBranches = { ...prev.branches };
      let changed = false;

      // Apply the move in ALL parent lists
      branch.parentIds.forEach(parentId => {
          const parent = newBranches[parentId];
          if (!parent) return;

          const currentIndex = parent.childrenIds.indexOf(branchId);
          if (currentIndex === -1) return;

          const newChildren = [...parent.childrenIds];

          if (direction === 'left' && currentIndex > 0) {
              const temp = newChildren[currentIndex - 1];
              newChildren[currentIndex - 1] = newChildren[currentIndex];
              newChildren[currentIndex] = temp;
              // Use Object.assign instead of spread to avoid TS error "Spread types may only be created from object types"
              newBranches[parentId] = Object.assign({}, parent, { childrenIds: newChildren });
              changed = true;
          } else if (direction === 'right' && currentIndex < newChildren.length - 1) {
              const temp = newChildren[currentIndex + 1];
              newChildren[currentIndex + 1] = newChildren[currentIndex];
              newChildren[currentIndex] = temp;
              // Use Object.assign instead of spread to avoid TS error "Spread types may only be created from object types"
              newBranches[parentId] = Object.assign({}, parent, { childrenIds: newChildren });
              changed = true;
          }
      });

      return changed ? { ...prev, branches: newBranches } : prev;
    });
  }, [setProjectState]);

  const addTask = useCallback((branchId: string, title: string) => {
    if (!title.trim()) return;

    setProjectState(prev => {
      const branch = prev.branches[branchId];
      if (!branch) return prev;
      
      const newTask: Task = {
        id: generateId(),
        title: title.trim(),
        completed: false,
        position: branch.tasks.length // Add to end based on length
      };

      return {
        ...prev,
        branches: {
          ...prev.branches,
          [branchId]: Object.assign({}, branch, {
            tasks: [...branch.tasks, newTask],
          }),
        },
      };
    });
  }, [setProjectState]);

  const updateTask = useCallback((branchId: string, taskId: string, data: Partial<Task>) => {
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;
        
        const newTasks = branch.tasks.map(t => t.id === taskId ? Object.assign({}, t, data) : t);
        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: Object.assign({}, branch, { tasks: newTasks })
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
                [branchId]: Object.assign({}, branch, { tasks: newTasks })
            }
        };
    });
  }, [setProjectState]);

  const moveTask = useCallback((branchId: string, taskId: string, direction: 'up' | 'down') => {
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;
        
        const tasks = [...branch.tasks];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return prev;

        // Swap array elements
        if (direction === 'up' && index > 0) {
            [tasks[index], tasks[index - 1]] = [tasks[index - 1], tasks[index]];
        } else if (direction === 'down' && index < tasks.length - 1) {
            [tasks[index], tasks[index + 1]] = [tasks[index + 1], tasks[index]];
        } else {
            return prev;
        }

        // CRITICAL FIX: Re-assign 'position' property to all tasks to match new array order
        const reorderedTasks = tasks.map((t, i) => Object.assign({}, t, { position: i }));
        
        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: Object.assign({}, branch, { tasks: reorderedTasks })
            }
        };
    });
  }, [setProjectState]);

  const bulkUpdateTasks = useCallback((branchId: string, rawText: string) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    setProjectState(prev => {
        const branch = prev.branches[branchId];
        if (!branch) return prev;

        // Correctly type the Map to avoid inference issues with Object.assign later
        const currentTasksMap = new Map<string, Task>(branch.tasks.map(t => [t.title, t]));
        
        const newTasks: Task[] = lines.map((line, index) => {
            const existingTask = currentTasksMap.get(line);
            if (existingTask) {
                // Use spread syntax to avoid 'Object.assign' type inference issues
                return { ...existingTask, position: index };
            }
            return {
                id: generateId(),
                title: line,
                completed: false,
                position: index
            };
        });

        return {
            ...prev,
            branches: {
                ...prev.branches,
                [branchId]: Object.assign({}, branch, { tasks: newTasks })
            }
        };
    });
  }, [setProjectState]);

  const addPerson = useCallback((name: string, email: string, phone: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    const newPerson: Person = {
        id: generateId(),
        name,
        email,
        phone, // New Field
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

        const updates = { ...data };
        if (data.name) {
             updates.initials = data.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }

        return {
            ...prev,
            people: prev.people.map(p => p.id === id ? Object.assign({}, p, updates) : p)
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
    
    let p: ProjectState = activeProject;
    
    if (p.rootBranchId === 'root' && p.branches['root']) {
        const newRootId = generateId();
        const oldRoot = p.branches['root'];
        
        if (oldRoot) {
            const newBranches = { ...p.branches };
            delete newBranches['root'];
            
            newBranches[newRootId] = Object.assign({}, oldRoot, { id: newRootId });
            
            oldRoot.childrenIds.forEach(childId => {
                if (newBranches[childId]) {
                     const updatedParentIds = newBranches[childId].parentIds.map(pid => pid === 'root' ? newRootId : pid);
                     newBranches[childId] = Object.assign({}, newBranches[childId], { parentIds: updatedParentIds });
                }
            });
    
            p = Object.assign({}, p, { rootBranchId: newRootId, branches: newBranches });
            setProjectState(prev => Object.assign({}, prev, { rootBranchId: newRootId, branches: newBranches }));
        }
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    // 1. Save Project
    const { error: pError } = await supabaseClient.from('flowtask_projects').upsert({
        id: p.id,
        name: p.name,
        root_branch_id: p.rootBranchId, 
        owner_id: user?.id,
        created_at: new Date().toISOString()
    });
    if (pError) throw pError;

    // 2. Sync People (Handle deletions)
    const localPersonIds = p.people.map(person => person.id);
    if (localPersonIds.length > 0) {
        await supabaseClient.from('flowtask_people').delete().eq('project_id', p.id).not('id', 'in', `(${localPersonIds.join(',')})`);
    } else {
        await supabaseClient.from('flowtask_people').delete().eq('project_id', p.id);
    }

    if (p.people.length > 0) {
        const peopleData = p.people.map(person => ({
            id: person.id,
            project_id: p.id,
            name: person.name,
            email: person.email,
            phone: person.phone, // Sync phone
            initials: person.initials,
            color: person.color
        }));
        await supabaseClient.from('flowtask_people').upsert(peopleData);
    }

    // 3. Sync Branches (Handle deletions)
    const localBranchIds = Object.keys(p.branches);
    if (localBranchIds.length > 0) {
         await supabaseClient.from('flowtask_branches').delete().eq('project_id', p.id).not('id', 'in', `(${localBranchIds.join(',')})`);
    } else {
         await supabaseClient.from('flowtask_branches').delete().eq('project_id', p.id);
    }

    const branches = Object.values(p.branches) as Branch[];
    if (branches.length > 0) {
        const branchesData = branches.map(b => {
             let pos = 0;
             if(b.parentIds.length > 0 && p.branches[b.parentIds[0]]) {
                 pos = p.branches[b.parentIds[0]].childrenIds.indexOf(b.id);
             }

             return {
                id: b.id,
                project_id: p.id,
                title: b.title,
                description: b.description || null,
                status: b.status,
                start_date: b.startDate || null,
                end_date: b.endDate || null,
                due_date: b.dueDate || null,
                archived: b.archived || false,
                parent_ids: b.parentIds,
                children_ids: b.childrenIds,
                position: pos,
                collapsed: b.collapsed || false, // Sync collapsed state
                is_label: b.isLabel || false // Sync isLabel
            };
        });
        await supabaseClient.from('flowtask_branches').upsert(branchesData);
    }

    // 4. Sync Tasks (Handle deletions)
    const allLocalTaskIds = branches.flatMap(b => b.tasks.map(t => t.id));
    if (localBranchIds.length > 0) {
        let query = supabaseClient.from('flowtask_tasks').delete().in('branch_id', localBranchIds);
        if (allLocalTaskIds.length > 0) {
            query = query.not('id', 'in', `(${allLocalTaskIds.join(',')})`);
        }
        await query;
    }

    const tasks = branches.flatMap(b => b.tasks.map((t, index) => ({
        id: t.id,
        branch_id: b.id,
        title: t.title,
        assignee_id: t.assigneeId,
        due_date: t.dueDate,
        completed: t.completed,
        position: index
    })));

    if (tasks.length > 0) {
        const { error: tError } = await supabaseClient.from('flowtask_tasks').upsert(tasks);
        if (tError) throw tError;
    }
  }, [supabaseClient, activeProject, setProjectState]);

  const listProjectsFromSupabase = useCallback(async () => {
      if (!supabaseClient) throw new Error("Client Supabase non inizializzato");

      const { data, error } = await supabaseClient.from('flowtask_projects').select('id, name, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
  }, [supabaseClient]);

  const getProjectBranchesFromSupabase = useCallback(async (projectId: string): Promise<Branch[]> => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");

    // Fetch branches
    const { data: branchesData, error } = await supabaseClient
        .from('flowtask_branches')
        .select('*')
        .eq('project_id', projectId);
    
    if (error) throw error;
    if (!branchesData) return [];

    // Map to local Branch type
    return branchesData.map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        status: b.status as BranchStatus,
        startDate: b.start_date,
        endDate: b.end_date,
        dueDate: b.due_date,
        tasks: [], // We don't need tasks for parent selection
        childrenIds: b.children_ids || [],
        parentIds: b.parent_ids || [],
        archived: b.archived,
        position: b.position,
        collapsed: b.collapsed,
        isLabel: b.is_label // Map from DB
    }));
  }, [supabaseClient]);

  const downloadProjectFromSupabase = useCallback(async (projectId: string, activate = true, removeDefault = false) => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");

    // 1. Fetch Project Info
    const { data: projectData, error: pError } = await supabaseClient
        .from('flowtask_projects')
        .select('*')
        .eq('id', projectId)
        .single();
    if (pError) throw pError;

    // 2. Fetch People (Increase Limit)
    const { data: peopleData, error: ppError } = await supabaseClient
        .from('flowtask_people')
        .select('*')
        .eq('project_id', projectId)
        .limit(1000); 
    if (ppError) throw ppError;

    // 3. Fetch Branches (Increase Limit)
    const { data: branchesData, error: bError } = await supabaseClient
        .from('flowtask_branches')
        .select('*')
        .eq('project_id', projectId)
        .limit(5000); 
    if (bError) throw bError;

    // 4. Fetch Tasks (Chunking + Limit)
    const branchIds = (branchesData || []).map((b: any) => b.id);
    let tasksData: any[] = [];
    
    if (branchIds.length > 0) {
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < branchIds.length; i += CHUNK_SIZE) {
            const chunk = branchIds.slice(i, i + CHUNK_SIZE);
            const { data: chunkData, error: tError } = await supabaseClient
                .from('flowtask_tasks')
                .select('*')
                .in('branch_id', chunk)
                .order('position', { ascending: true })
                .limit(5000);
            
            if (tError) throw tError;
            if (chunkData) {
                tasksData = tasksData.concat(chunkData);
            }
        }
    }

    // --- RECONSTRUCT STATE ---
    
    // Map People
    const people: Person[] = peopleData.map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone, // Restore phone
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
            completed: t.completed,
            position: t.position
        });
    });

    // Map Branches and SORT tasks for each branch
    const branches: Record<string, Branch> = {};
    // Use saved rootBranchId from DB first
    let rootBranchId = projectData.root_branch_id; 
    
    branchesData.forEach((b: any) => {
        const branchTasks = (tasksByBranch[b.id] || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        
        const parentIds = b.parent_ids || [];
        const childrenIds = b.children_ids || [];

        branches[b.id] = {
            id: b.id,
            title: b.title,
            description: b.description,
            status: b.status as BranchStatus,
            startDate: b.start_date,
            endDate: b.end_date,
            dueDate: b.due_date,
            tasks: branchTasks,
            childrenIds: childrenIds, 
            parentIds: parentIds,
            archived: b.archived,
            position: b.position,
            collapsed: b.collapsed || false, // Sync collapsed state
            isLabel: b.is_label // Map from DB
        };
    });
    
    // Fallback logic if root_branch_id was missing or invalid
    if ((!rootBranchId || !branches[rootBranchId]) && branchesData.length > 0) {
        const orphans = branchesData.filter((b: any) => (b.parent_ids || []).length === 0);
        
        if (orphans.length > 0) {
             const trueRootCandidate = orphans.find((b: any) => (b.children_ids || []).length > 0);
             if (trueRootCandidate) {
                 rootBranchId = trueRootCandidate.id;
             } else {
                 rootBranchId = orphans[0].id;
             }
        } else {
             rootBranchId = branchesData[0].id;
        }
    }

    const newState: ProjectState = {
        id: projectData.id,
        name: projectData.name,
        people: people,
        branches: branches,
        rootBranchId: rootBranchId || 'root' 
    };

    isRemoteUpdate.current = true;
    loadProject(newState, activate, removeDefault);
  }, [supabaseClient, loadProject]);

  const moveLocalBranchToRemoteProject = useCallback(async (branchIdToMove: string, targetProjectId: string, targetParentId: string) => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");
    
    if (branchIdToMove === activeProject.rootBranchId) {
        throw new Error("Non puoi spostare il ramo radice (Inizio Progetto) in un altro progetto.");
    }

    // 1. Identify Subtree (Use local state for recursion - it's faster and guaranteed to be consistent with what we see)
    const findAllLocalDescendants = (bId: string): string[] => {
        const descendants: string[] = [];
        const branch = activeProject.branches[bId];
        if (branch) {
            branch.childrenIds.forEach(childId => {
                descendants.push(childId);
                descendants.push(...findAllLocalDescendants(childId));
            });
        }
        return descendants;
    };

    const descendants = findAllLocalDescendants(branchIdToMove);
    const idsToMove = [branchIdToMove, ...descendants];

    // 2. Unlink from LOCAL parents in DB (Cleanup Current Project)
    const movingBranch = activeProject.branches[branchIdToMove];
    if (movingBranch) {
        for (const parentId of movingBranch.parentIds) {
            const parent = activeProject.branches[parentId];
            if (parent) {
                const newChildren = parent.childrenIds.filter(id => id !== branchIdToMove);
                await supabaseClient
                    .from('flowtask_branches')
                    .update({ children_ids: newChildren })
                    .eq('id', parentId);
            }
        }
    }

    // 3. Move Subtree (Update Project ID for all branches in subtree)
    const { error: updateError } = await supabaseClient
        .from('flowtask_branches')
        .update({ project_id: targetProjectId })
        .in('id', idsToMove);
    
    if (updateError) throw updateError;

    // 4. Link to Remote Parent (in the Target Project)
    
    // 4a. Update the moved root branch to point to the new remote parent
    await supabaseClient
        .from('flowtask_branches')
        .update({ parent_ids: [targetParentId] })
        .eq('id', branchIdToMove);

    // 4b. Update the target parent (remote) to include the moved branch as child
    const { data: remoteParent } = await supabaseClient
        .from('flowtask_branches')
        .select('children_ids')
        .eq('id', targetParentId)
        .single();
    
    if (remoteParent) {
        const currentChildren = remoteParent.children_ids || [];
        if (!currentChildren.includes(branchIdToMove)) {
            await supabaseClient
                .from('flowtask_branches')
                .update({ children_ids: [...currentChildren, branchIdToMove] })
                .eq('id', targetParentId);
        }
    }

    // 5. Reload Current Project to reflect disappearance of moved branch
    await downloadProjectFromSupabase(activeProjectId, false, false);

  }, [supabaseClient, activeProjectId, activeProject, downloadProjectFromSupabase]);

  const deleteProjectFromSupabase = useCallback(async (projectId: string) => {
    if (!supabaseClient) throw new Error("Client Supabase non inizializzato");
    
    const { error } = await supabaseClient.from('flowtask_projects').delete().eq('id', projectId);
    
    if (error) throw error;
  }, [supabaseClient]);

  // AUTO SYNC EFFECT (Local -> Cloud)
  useEffect(() => {
    if (!session || isOfflineMode || !supabaseClient) return;
    
    if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
    }
    
    if (autoSaveStatus !== 'saving') setAutoSaveStatus('saving');

    const timeoutId = setTimeout(() => {
        uploadProjectToSupabase()
            .then(() => setAutoSaveStatus('saved'))
            .catch((e) => {
                console.error("Auto-save failed", e);
                setAutoSaveStatus('error');
            });
    }, 2000); 

    return () => clearTimeout(timeoutId);
  }, [activeProject, session, isOfflineMode, supabaseClient, uploadProjectToSupabase]);

  // INITIAL LOAD & REALTIME SYNC (Cloud -> Local)
  useEffect(() => {
      if (!session || !supabaseClient || isOfflineMode || !activeProjectId || activeProjectId === 'default-project') return;

      const sync = async () => {
           try {
              const { count } = await supabaseClient.from('flowtask_projects').select('id', { count: 'exact', head: true }).eq('id', activeProjectId);
              if (count && count > 0) {
                   await downloadProjectFromSupabase(activeProjectId, false, false);
              }
           } catch(e) { console.error("Sync error", e); }
      };

      sync();

      const channel = supabaseClient.channel(`project-sync-${activeProjectId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'flowtask_branches', filter: `project_id=eq.${activeProjectId}` }, () => {
              console.log("Remote change detected, syncing...");
              sync();
          })
          .subscribe();

      return () => { supabaseClient.removeChannel(channel); };
  }, [activeProjectId, session, isOfflineMode, supabaseClient]); 

  useEffect(() => {
    if (isOfflineMode) {
        setIsInitializing(false);
    }
  }, [isOfflineMode]);

  useEffect(() => {
    let isMounted = true;
    if (!loadingAuth) {
         if (isMounted) setIsInitializing(false);
    }
    return () => { isMounted = false; };
  }, [loadingAuth]);

  return (
    <ProjectContext.Provider value={{
      state: activeProject,
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
      moveBranch,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      bulkUpdateTasks,
      addPerson,
      updatePerson,
      removePerson,
      selectedBranchId,
      selectBranch: setSelectedBranchId,
      readingDescriptionId,
      setReadingDescriptionId,
      editingTask,
      setEditingTask,
      remindingUserId,
      setRemindingUserId,
      toggleBranchArchive,
      showArchived,
      toggleShowArchived,

      supabaseConfig,
      supabaseClient,
      session,
      loadingAuth,
      isInitializing,
      isOfflineMode,
      enableOfflineMode,
      disableOfflineMode,
      setSupabaseConfig,
      uploadProjectToSupabase,
      downloadProjectFromSupabase,
      deleteProjectFromSupabase,
      listProjectsFromSupabase,
      getProjectBranchesFromSupabase,
      moveLocalBranchToRemoteProject,
      logout,
      
      autoSaveStatus,
      notification,
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