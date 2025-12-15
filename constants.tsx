import { BranchStatus, ProjectState, Person } from './types';
import { Users, AlertCircle, CheckCircle2, XCircle, Clock, Map } from 'lucide-react';
import React from 'react';

export const INITIAL_PEOPLE: Person[] = [];

export const INITIAL_STATE: ProjectState = {
  id: 'default-project',
  name: 'Nuovo Progetto',
  rootBranchId: 'root',
  people: [],
  branches: {
    'root': {
      id: 'root',
      title: 'Inizio Progetto',
      description: 'Punto di partenza del flusso',
      status: BranchStatus.PLANNED,
      isLabel: true, // Default to Label for root
      tasks: [],
      childrenIds: [],
      parentIds: [],
    }
  }
};

export const STATUS_CONFIG = {
  [BranchStatus.PLANNED]: { color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', icon: <Map className="w-4 h-4" />, label: 'Pianificato' },
  [BranchStatus.ACTIVE]: { color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400', icon: <Clock className="w-4 h-4" />, label: 'Attivo' },
  [BranchStatus.STANDBY]: { color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400', icon: <AlertCircle className="w-4 h-4" />, label: 'Standby' },
  [BranchStatus.CLOSED]: { color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Chiuso' },
  [BranchStatus.CANCELLED]: { color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-4 h-4" />, label: 'Annullato' },
};