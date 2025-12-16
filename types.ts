
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
  phone?: string; // Added phone field
  initials: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  assigneeId?: string;
  dueDate?: string; // ISO Date string YYYY-MM-DD
  completed: boolean;
  completedAt?: string; // ISO Date string (Timestamp)
  position?: number; // Added for ordering
}

export interface Branch {
  id: string;
  title: string;
  description?: string;
  status: BranchStatus;
  isLabel?: boolean; // New field: treats branch as a label/container
  startDate?: string; // ISO Date string YYYY-MM-DD (Automatic on ACTIVE)
  endDate?: string;   // ISO Date string YYYY-MM-DD (Automatic on CLOSED/CANCELLED)
  dueDate?: string;   // ISO Date string YYYY-MM-DD (Deadline)
  tasks: Task[];
  childrenIds: string[];
  parentIds: string[]; // Changed from parentId: string | null
  archived?: boolean;
  position?: number; // Added for explicit SQL ordering
  collapsed?: boolean; // New field for UI collapsing
}

export interface ProjectState {
  id: string;   // Unique ID for the project tab
  name: string; // Display name for the tab
  branches: Record<string, Branch>;
  people: Person[];
  rootBranchId: string;
}

export type Theme = 'light' | 'dark';
