// Added React import to resolve missing namespace error
import React, { useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Person } from '../types';
import { persistenceService } from '../services/persistence';

const generateId = () => crypto.randomUUID();

export const usePeopleActions = (
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: SupabaseClient | null
) => {
  const addPerson = useCallback((name: string, email?: string, phone?: string) => {
    const newId = generateId();
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newPerson: Person = { 
        id: newId, name, email, phone, initials: name.slice(0,2).toUpperCase(), 
        color: 'bg-indigo-500', version: 1, updatedAt: new Date().toISOString() 
      };
      const nextState = { ...p, people: [...p.people, newPerson] };
      persistenceService.savePerson(p.id, newPerson, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const person = p.people.find(pe => pe.id === id);
      if (!person) return p;
      const nextPerson = { ...person, ...updates, updatedAt: new Date().toISOString() };
      const nextState = { ...p, people: p.people.map(pe => pe.id === id ? nextPerson : pe) };
      persistenceService.savePerson(p.id, nextPerson, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const removePerson = useCallback((id: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const nextState = { ...p, people: p.people.filter(x => x.id !== id) };
      persistenceService.deletePerson(id, isOfflineMode, supabaseClient, nextState);
      return nextState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addPerson, updatePerson, removePerson };
};