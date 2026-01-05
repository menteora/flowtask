
export enum BranchStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  STANDBY = 'STANDBY',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string; 
  initials: string;
  color: string;
  version: number;
  updatedAt?: string;
  deletedAt?: string;
  isDirty?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string; 
  assigneeId?: string;
  dueDate?: string; 
  completed: boolean;
  completedAt?: string; 
  position?: number; 
  pinned?: boolean; 
  version: number;
  updatedAt?: string;
  deletedAt?: string;
  isDirty?: boolean;
}

export interface Branch {
  id: string;
  title: string;
  description?: string;
  status: BranchStatus;
  isLabel?: boolean; 
  isSprint?: boolean; 
  sprintCounter?: number; 
  responsibleId?: string;
  startDate?: string; 
  endDate?: string;   
  dueDate?: string;   
  tasks: Task[];
  childrenIds: string[];
  parentIds: string[]; 
  archived?: boolean;
  position?: number; 
  collapsed?: boolean; 
  version: number;
  updatedAt?: string;
  deletedAt?: string;
  isDirty?: boolean;
}

export interface DeletedRecord {
  id: string;
  table: 'flowtask_projects' | 'flowtask_branches' | 'flowtask_tasks' | 'flowtask_people';
  version: number;
  label: string;
}

export interface ProjectState {
  id: string;   
  name: string; 
  branches: Record<string, Branch>;
  people: Person[];
  rootBranchId: string;
  version: number;
  updatedAt?: string;
  deletedAt?: string;
  isDirty?: boolean;
  pendingDeletions?: DeletedRecord[]; // Coda per sync eliminazioni
}

export type Theme = 'light' | 'dark';
