
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
  isDirty?: boolean; // Flag per sync client -> server
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
  isDirty?: boolean; // Flag per sync client -> server
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
  isDirty?: boolean; // Flag per sync client -> server
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
  isDirty?: boolean; // Flag per sync client -> server
}

export type Theme = 'light' | 'dark';
