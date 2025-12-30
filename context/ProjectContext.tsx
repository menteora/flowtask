import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus } from '../types';
import { createInitialProjectState } from '../constants';

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
  session: any;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pendingSyncIds: Set<string>;
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

  checkProjectHealth: (project?: ProjectState) => ProjectHealthReport;
  repairProjectStructure: () => Promise<ProjectState | null>;
  resolveOrphans: (idsToFix: string[], idsToDelete: string[]) => Promise<void>;

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
      try { return JSON.parse(saved); } catch (e) { console.error("Parse projects error", e); }
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
  const [showOnlyOpen, setShowOnlyOpen] = useState(() => localStorage.getItem('flowtask_show_only_open') === 'true');
  
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
  const [session, setSession] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  
  const lastSyncedProjectIdRef = useRef<string | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  }, []);

  const syncEntityToSupabase = useCallback(async (table: string, payload: any) => {
    if (!supabaseClient || !session || isOfflineMode) return;
    const recordId = payload.id;
    if (recordId) setPendingSyncIds(prev => new Set(prev).add(recordId));
    try {
        const { error } = await supabaseClient.from(table).upsert(payload);
        if (error) throw error;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (e) {
        console.error(`Sync error on ${table}:`, e);
        setAutoSaveStatus('error');
    } finally {
        if (recordId) {
            setTimeout(() => {
                setPendingSyncIds(prev => {
                    const next = new Set(prev);
                    next.delete(recordId);
                    return next;
                });
            }, 500);
        }
    }
  }, [supabaseClient, session, isOfflineMode]);

  const loadProject = useCallback((newState: ProjectState, activate = true, removeDefault = false) => {
    setProjects(prev => {
        let next = [...prev];
        const existingIdx = next.findIndex(p => p.id === newState.id);
        if (existingIdx >= 0) next[existingIdx] = newState;
        else next.push(newState);
        if (removeDefault) next = next.filter(p => p.id !== 'default-project');
        return next;
    });
    if (activate) setActiveProjectId(newState.id);
  }, []);

  const downloadProjectFromSupabase = useCallback(async (id: string, activate = true, force = false) => {
      if (!supabaseClient || !session) return;
      try {
          const { data: p, error: pErr } = await supabaseClient.from('flowtask_projects').select('*').eq('id', id).single();
          if (pErr) throw pErr;
          const [{ data: peopleData }, { data: branchesData }] = await Promise.all([
              supabaseClient.from('flowtask_people').select('*').eq('project_id', id),
              supabaseClient.from('flowtask_branches').select('*').eq('project_id', id)
          ]);
          const { data: tasksData } = await supabaseClient.from('flowtask_tasks').select('*').in('branch_id', branchesData?.map(b => b.id) || []);
          
          const people: Person[] = (peopleData || []).map(p => ({
              id: p.id, name: p.name, email: p.email, phone: p.phone, initials: p.initials, color: p.color
          }));

          const branches: Record<string, Branch> = {};
          (branchesData || []).forEach(b => {
              const bTasks = (tasksData || [])
                  .filter(t => t.branch_id === b.id)
                  .sort((x, y) => (x.position || 0) - (y.position || 0))
                  .map(t => ({
                    id: t.id, title: t.title, description: t.description, completed: t.completed,
                    completedAt: t.completed_at, assigneeId: t.assignee_id, dueDate: t.due_date, pinned: t.pinned || false
                  }));
              branches[b.id] = {
                  id: b.id, title: b.title, description: b.description, status: b.status as BranchStatus,
                  tasks: bTasks, childrenIds: b.children_ids || [], parentIds: b.parent_ids || [],
                  startDate: b.start_date, endDate: b.end_date, dueDate: b.due_date,
                  archived: b.archived, collapsed: b.collapsed, isLabel: b.is_label,
                  isSprint: b.is_sprint || false, sprintCounter: b.sprint_counter || 1,
                  responsibleId: b.responsible_id
              };
          });
          loadProject({ id: p.id, name: p.name, rootBranchId: p.root_branch_id, branches, people }, activate, true); 
          lastSyncedProjectIdRef.current = id;
      } catch (e: any) {
          console.error("Download Error:", e);
          if (force) showNotification("Errore download: " + e.message, 'error');
      }
  }, [supabaseClient, session, loadProject, showNotification]);

  const uploadProjectToSupabase = useCallback(async () => {
    if (!supabaseClient || !session || isOfflineMode) return;
    const p = projects.find(x => x.id === activeProjectId);
    if (!p || p.id === 'default-project') return;
    setAutoSaveStatus('saving');
    try {
        await supabaseClient.from('flowtask_projects').upsert({
            id: p.id, name: p.name, root_branch_id: p.rootBranchId, owner_id: session.user.id
        });
        const people = p.people.map(x => ({ ...x, project_id: p.id }));
        if (people.length > 0) await supabaseClient.from('flowtask_people').upsert(people);
        // FIX: Cast Object.values to Branch[] to avoid 'unknown' errors when using older TypeScript or certain configurations
        const branches = (Object.values(p.branches) as Branch[]).map(b => ({
            id: b.id, project_id: p.id, title: b.title, description: b.description, status: b.status,
            start_date: b.startDate, end_date: b.endDate, due_date: b.dueDate, archived: b.archived,
            collapsed: b.collapsed, is_label: b.isLabel, is_sprint: b.isSprint || false,
            sprint_counter: b.sprintCounter || 1, parent_ids: b.parentIds, children_ids: b.childrenIds,
            responsible_id: b.responsibleId
        }));
        if (branches.length > 0) await supabaseClient.from('flowtask_branches').upsert(branches);
        const tasks: any[] = [];
        // FIX: Cast Object.values to Branch[] to avoid 'unknown' errors when accessing tasks
        (Object.values(p.branches) as Branch[]).forEach(b => b.tasks.forEach((t, i) => tasks.push({
            id: t.id, branch_id: b.id, title: t.title, description: t.description, assignee_id: t.assigneeId,
            due_date: t.dueDate, completed: t.completed, completed_at: t.completedAt, position: t.position ?? i, pinned: t.pinned || false
        })));
        if (tasks.length > 0) await supabaseClient.from('flowtask_tasks').upsert(tasks);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (e) { setAutoSaveStatus('error'); }
  }, [supabaseClient, session, isOfflineMode, projects, activeProjectId]);

  useEffect(() => {
    const stored = localStorage.getItem('supabase_config');
    if (stored) { try { setSupabaseConfigState(JSON.parse(stored)); } catch(e) {} }
    setIsInitializing(false);
    setLoadingAuth(false); 
  }, []);

  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
        const client = createClient(supabaseConfig.url, supabaseConfig.key);
        setSupabaseClient(client);
        (client.auth as any).getSession().then(({ data: { session } }: any) => setSession(session));
        const { data: { subscription } } = (client.auth as any).onAuthStateChange((_event: any, session: any) => setSession(session));
        return () => subscription.unsubscribe();
    }
  }, [supabaseConfig]);

  useEffect(() => {
      const active = projects.find(p => p.id === activeProjectId);
      if (session && !isOfflineMode && activeProjectId && active && !active.id.includes('default') && lastSyncedProjectIdRef.current !== activeProjectId) {
          downloadProjectFromSupabase(activeProjectId, false, false);
      }
  }, [session, isOfflineMode, activeProjectId, downloadProjectFromSupabase, projects]);

  useEffect(() => {
      localStorage.setItem('flowtask_projects', JSON.stringify(projects));
      localStorage.setItem('active_project_id', activeProjectId);
      localStorage.setItem('flowtask_show_only_open', showOnlyOpen.toString());
  }, [projects, activeProjectId, showOnlyOpen]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  const getInheritedResponsibleId = useCallback((branchId: string, branches: Record<string, Branch>): string | undefined => {
    const branch = branches[branchId];
    if (!branch) return undefined;
    if (branch.responsibleId) return branch.responsibleId;
    if (branch.parentIds && branch.parentIds.length > 0) {
        return getInheritedResponsibleId(branch.parentIds[0], branches);
    }
    return undefined;
  }, []);

  const addBranch = useCallback((parentId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const parent = p.branches[parentId];
          let title = 'Nuovo Ramo';
          let updatedParent = { ...parent };
          if (parent?.isSprint) {
              const year = new Date().getFullYear().toString().slice(-2);
              title = `${parent.title} ${year}-${String(parent.sprintCounter || 1).padStart(2, '0')}`;
              updatedParent.sprintCounter = (parent.sprintCounter || 1) + 1;
          }
          const newId = crypto.randomUUID();
          const newBranch = { id: newId, title, status: BranchStatus.PLANNED, tasks: [], childrenIds: [], parentIds: [parentId], description: '', isLabel: false, isSprint: false, sprintCounter: 1 };
          const branches = { ...p.branches, [newId]: newBranch, [parentId]: { ...updatedParent, childrenIds: [...updatedParent.childrenIds, newId] } };
          
          syncEntityToSupabase('flowtask_branches', { 
              id: newId, 
              project_id: p.id, 
              title, 
              status: BranchStatus.PLANNED, 
              parent_ids: [parentId], 
              children_ids: [],
              archived: false,
              collapsed: false
          });
          syncEntityToSupabase('flowtask_branches', { 
              id: parentId, 
              project_id: p.id, 
              title: branches[parentId].title,
              status: branches[parentId].status,
              children_ids: branches[parentId].childrenIds, 
              sprint_counter: branches[parentId].sprintCounter 
          });
          
          return { ...p, branches };
      }));
  }, [activeProjectId, syncEntityToSupabase]);

  const updateBranch = useCallback((branchId: string, updates: Partial<Branch>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[branchId]) return p;
          const currentBranch = p.branches[branchId];
          const updated = { ...currentBranch, ...updates };
          
          // FIX NOT-NULL: Inviamo sempre i campi obbligatori title e status per evitare errori di vincolo DB
          const dbPayload: any = { 
              id: branchId, 
              project_id: p.id,
              title: updated.title,
              status: updated.status,
              description: updated.description || '',
              is_label: updated.is_label || false,
              is_sprint: updated.is_sprint || false,
              sprint_counter: updated.sprint_counter || 1,
              responsible_id: updated.responsible_id || null,
              start_date: updated.start_date || null,
              due_date: updated.due_date || null,
              archived: updated.archived || false,
              collapsed: updated.collapsed || false,
              parent_ids: updated.parent_ids || [],
              children_ids: updated.children_ids || []
          };

          syncEntityToSupabase('flowtask_branches', dbPayload);
          return { ...p, branches: { ...p.branches, [branchId]: updated } };
      }));
  }, [activeProjectId, syncEntityToSupabase]);

  const deleteBranch = useCallback(async (branchId: string) => {
      if (supabaseClient && !isOfflineMode) await supabaseClient.from('flowtask_branches').delete().eq('id', branchId);
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const next = { ...p.branches };
          const b = next[branchId];
          if (!b) return p;
          b.parentIds.forEach(pid => { if (next[pid]) next[pid].childrenIds = next[pid].childrenIds.filter(id => id !== branchId); });
          delete next[branchId];
          return { ...p, branches: next };
      }));
      if (selectedBranchId === branchId) setSelectedBranchId(null);
  }, [activeProjectId, selectedBranchId, isOfflineMode, supabaseClient]);

  const addTask = useCallback((branchId: string, title: string) => {
      const newId = crypto.randomUUID();
      const inheritedAssigneeId = getInheritedResponsibleId(branchId, activeProject.branches);
      const newTask: Task = { id: newId, title, completed: false, description: '', pinned: false, assigneeId: inheritedAssigneeId };
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[branchId]) return p;
          syncEntityToSupabase('flowtask_tasks', { 
              id: newId, 
              branch_id: branchId, 
              title, 
              completed: false, 
              assignee_id: inheritedAssigneeId,
              pinned: false,
              description: ''
          });
          return { ...p, branches: { ...p.branches, [branchId]: { ...p.branches[branchId], tasks: [...p.branches[branchId].tasks, newTask] } } };
      }));
  }, [activeProjectId, syncEntityToSupabase, activeProject.branches, getInheritedResponsibleId]);

  const updateTask = useCallback((branchId: string, taskId: string, updates: Partial<Task>) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId || !p.branches[branchId]) return p;
          const branch = p.branches[branchId];
          const task = branch.tasks.find(t => t.id === taskId);
          if (!task) return p;

          const updatedTask = { ...task, ...updates };

          // FIX NOT-NULL: Inviamo i campi obbligatori
          const dbPayload: any = { 
              id: taskId, 
              branch_id: branchId,
              title: updatedTask.title,
              completed: updatedTask.completed,
              completed_at: updatedTask.completed ? (updatedTask.completedAt || new Date().toISOString()) : null,
              assignee_id: updatedTask.assigneeId || null,
              due_date: updatedTask.dueDate || null,
              pinned: updatedTask.pinned || false,
              description: updatedTask.description || ''
          };

          syncEntityToSupabase('flowtask_tasks', dbPayload);
          const nextTasks = branch.tasks.map(t => t.id === taskId ? updatedTask : t);
          return { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: nextTasks } } };
      }));
  }, [activeProjectId, syncEntityToSupabase]);

  const addPerson = useCallback((name: string, email?: string, phone?: string) => {
    const np = { id: crypto.randomUUID(), name, email, phone, initials: name.slice(0, 2).toUpperCase(), color: 'bg-indigo-500' };
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        syncEntityToSupabase('flowtask_people', { ...np, project_id: p.id });
        return { ...p, people: [...p.people, np] };
    }));
  }, [activeProjectId, syncEntityToSupabase]);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const person = p.people.find(x => x.id === id);
        if (!person) return p;
        
        const updatedPerson = { ...person, ...updates };
        syncEntityToSupabase('flowtask_people', { ...updatedPerson, project_id: p.id });
        return { ...p, people: p.people.map(x => x.id === id ? updatedPerson : x) };
    }));
  }, [activeProjectId, syncEntityToSupabase]);

  const removePerson = useCallback((id: string) => {
    if (supabaseClient && !isOfflineMode) supabaseClient.from('flowtask_people').delete().eq('id', id).then(() => {});
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, people: p.people.filter(x => x.id !== id) } : p));
  }, [activeProjectId, supabaseClient, isOfflineMode]);

  const setSupabaseConfig = (url: string, key: string) => {
      setSupabaseConfigState({ url, key });
      localStorage.setItem('supabase_config', JSON.stringify({ url, key }));
  };

  const logout = async () => { if (supabaseClient) await (supabaseClient.auth as any).signOut(); setSession(null); };
  const enableOfflineMode = () => setIsOfflineMode(true);
  const disableOfflineMode = () => setIsOfflineMode(false);

  return (
    <ProjectContext.Provider value={{
      state: activeProject, projects, activeProjectId, selectedBranchId, showArchived, showAllProjects, showOnlyOpen,
      session, isOfflineMode, loadingAuth, isInitializing, autoSaveStatus, pendingSyncIds, notification, supabaseConfig, supabaseClient,
      setSupabaseConfig, switchProject: setActiveProjectId, createProject: () => {
          const np = createInitialProjectState('Progetto ' + (projects.length + 1));
          setProjects(prev => [...prev, np]); setActiveProjectId(np.id);
      }, closeProject: id => setProjects(prev => prev.filter(x => x.id !== id)), 
      renameProject: name => setProjects(prev => prev.map(x => x.id === activeProjectId ? { ...x, name } : x)),
      loadProject, selectBranch: setSelectedBranchId, toggleShowArchived: () => setShowArchived(!showArchived),
      toggleShowAllProjects: () => setShowAllProjects(!showAllProjects), toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
      addBranch, updateBranch, deleteBranch, addTask, updateTask, toggleBranchArchive: id => {
        const b = activeProject.branches[id]; if (b) updateBranch(id, { archived: !b.archived });
      },
      deleteTask: async (bid, tid) => {
          if (supabaseClient && !isOfflineMode) await supabaseClient.from('flowtask_tasks').delete().eq('id', tid);
          setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, branches: { ...p.branches, [bid]: { ...p.branches[bid], tasks: p.branches[bid].tasks.filter(t => t.id !== tid) } } } : p));
      },
      addPerson, updatePerson, removePerson,
      readingDescriptionId, setReadingDescriptionId, editingTask, setEditingTask, readingTask, setReadingTask,
      remindingUserId, setRemindingUserId, messageTemplates, 
      // FIX: Explicitly type parameter 't' to avoid spread error from inferred 'unknown' types
      updateMessageTemplates: (t: Partial<{ opening: string; closing: string }>) => setMessageTemplates(prev => ({ ...prev, ...t })),
      uploadProjectToSupabase, downloadProjectFromSupabase, 
      listProjectsFromSupabase: async () => (await supabaseClient?.from('flowtask_projects').select('*'))?.data || [],
      getProjectBranchesFromSupabase: async pid => (await supabaseClient?.from('flowtask_branches').select('*').eq('project_id', pid))?.data as any,
      deleteProjectFromSupabase: async id => { await supabaseClient?.from('flowtask_projects').delete().eq('id', id); },
      logout, enableOfflineMode, disableOfflineMode, showNotification,
      moveBranch: () => {}, linkBranch: () => {}, unlinkBranch: () => {}, 
      setAllBranchesCollapsed: c => setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, branches: Object.fromEntries(Object.entries(p.branches).map(([k, v]) => [k, { ...v, collapsed: c }])) } : p)),
      moveTask: () => {}, moveTaskToBranch: () => {}, bulkMoveTasks: () => {}, bulkUpdateTasks: () => {}, cleanupOldTasks: async () => ({ count: 0, backup: [] }),
      checkProjectHealth: () => ({ legacyRootFound: false, missingRootNode: false, orphanedBranches: [], totalIssues: 0 }),
      repairProjectStructure: async () => null, resolveOrphans: async () => {}, moveLocalBranchToRemoteProject: async () => {}
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