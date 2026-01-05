
import React, { createContext, useContext, useState } from 'react';
import { useProject } from './ProjectContext';
import { useTaskActions } from '../hooks/useTaskActions';
import { usePeopleActions } from '../hooks/usePeopleActions';
import { Task, Person } from '../types';

interface TaskContextType {
  editingTask: { branchId: string; taskId: string } | null;
  setEditingTask: (val: { branchId: string; taskId: string } | null) => void;
  readingTask: { branchId: string; taskId: string } | null;
  setReadingTask: (val: { branchId: string; taskId: string } | null) => void;
  readingDescriptionId: string | null;
  setReadingDescriptionId: (id: string | null) => void;
  remindingUserId: string | null;
  setRemindingUserId: (id: string | null) => void;
  showOnlyOpen: boolean;
  toggleShowOnlyOpen: () => void;
  messageTemplates: { opening: string; closing: string };
  updateMessageTemplates: (templates: Partial<{ opening: string; closing: string }>) => void;

  // Actions
  addTask: (branchId: string, title: string) => void;
  updateTask: (branchId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToBranch: (taskId: string, sourceBranchId: string, targetBranchId: string) => void;
  bulkUpdateTasks: (branchId: string, text: string) => void;
  bulkMoveTasks: (taskIds: string[], sourceBranchId: string, targetBranchId: string) => void;
  
  // People Actions
  addPerson: (name: string, email?: string, phone?: string) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setProjects, activeProjectId, isOfflineMode, supabaseClient } = useProject();
  
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState({ opening: "Ciao {name}, ecco i tuoi task:", closing: "Buon lavoro!" });

  const taskActions = useTaskActions(setProjects, activeProjectId, isOfflineMode, supabaseClient);
  const peopleActions = usePeopleActions(setProjects, activeProjectId, isOfflineMode, supabaseClient);

  return (
    <TaskContext.Provider value={{
      editingTask, setEditingTask,
      readingTask, setReadingTask,
      readingDescriptionId, setReadingDescriptionId,
      remindingUserId, setRemindingUserId,
      showOnlyOpen, toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
      messageTemplates, updateMessageTemplates: (ts) => setMessageTemplates(p => ({ ...p, ...ts })),
      ...taskActions,
      ...peopleActions
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTask must be used within a TaskProvider');
  return context;
};
