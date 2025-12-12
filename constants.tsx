import { BranchStatus, ProjectState, Person } from './types';
import { Users, AlertCircle, CheckCircle2, XCircle, Clock, Map } from 'lucide-react';
import React from 'react';

export const INITIAL_PEOPLE: Person[] = [
  { id: 'p1', name: 'Mario Rossi', email: 'mario.rossi@example.com', initials: 'MR', color: 'bg-blue-500' },
  { id: 'p2', name: 'Luca Bianchi', email: 'luca.bianchi@example.com', initials: 'LB', color: 'bg-green-500' },
  { id: 'p3', name: 'Sofia Verdi', email: 'sofia.verdi@example.com', initials: 'SV', color: 'bg-purple-500' },
  { id: 'p4', name: 'Giulia Neri', email: 'giulia.neri@example.com', initials: 'GN', color: 'bg-orange-500' },
];

export const INITIAL_STATE: ProjectState = {
  id: 'default-project',
  name: 'Progetto Alpha',
  rootBranchId: 'root',
  people: INITIAL_PEOPLE,
  branches: {
    'root': {
      id: 'root',
      title: 'Project Kickoff',
      description: 'Initial planning phase',
      status: BranchStatus.CLOSED,
      tasks: [
        { id: 't1', title: 'Define scope', completed: true, assigneeId: 'p1' },
        { id: 't2', title: 'Budget approval', completed: true, assigneeId: 'p2' },
      ],
      childrenIds: ['b1', 'b2'],
      parentIds: [],
    },
    'b1': {
      id: 'b1',
      title: 'Frontend Development',
      status: BranchStatus.ACTIVE,
      tasks: [
        { id: 't3', title: 'Setup React repo', completed: true, assigneeId: 'p1' },
        { id: 't4', title: 'Implement Tailwind', completed: false, assigneeId: 'p3' },
      ],
      childrenIds: ['b3'],
      parentIds: ['root'],
    },
    'b2': {
      id: 'b2',
      title: 'Backend Development',
      status: BranchStatus.STANDBY,
      tasks: [
        { id: 't5', title: 'Database Schema', completed: false, assigneeId: 'p2' },
      ],
      childrenIds: [],
      parentIds: ['root'],
    },
    'b3': {
      id: 'b3',
      title: 'UI Testing',
      status: BranchStatus.ACTIVE,
      tasks: [],
      childrenIds: [],
      parentIds: ['b1'],
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