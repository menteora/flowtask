
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useProject } from './ProjectContext';
import { useBranchActions } from '../hooks/useBranchActions';
import { Branch } from '../types';

interface BranchContextType {
  selectedBranchId: string | null;
  selectBranch: (id: string | null) => void;
  showArchived: boolean;
  toggleShowArchived: () => void;
  showAllProjects: boolean;
  toggleShowAllProjects: () => void;
  
  // Actions
  addBranch: (parentId: string) => void;
  updateBranch: (branchId: string, updates: Partial<Branch>) => void;
  moveBranch: (branchId: string, direction: 'prev' | 'next' | 'up' | 'down') => void;
  deleteBranch: (branchId: string) => void;
  linkBranch: (childId: string, parentId: string) => void;
  unlinkBranch: (childId: string, parentId: string) => void;
  toggleBranchArchive: (branchId: string) => void;
  setAllBranchesCollapsed: (collapsed: boolean) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setProjects, activeProjectId, isOfflineMode, supabaseClient } = useProject();
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const actions = useBranchActions(setProjects, activeProjectId, isOfflineMode, supabaseClient);

  // Mappatura alias per compatibilità con FolderTree (up/down) e FlowCanvas (prev/next)
  const moveBranchMapped = (id: string, direction: 'prev' | 'next' | 'up' | 'down') => {
      const dir = (direction === 'up' || direction === 'prev') ? 'prev' : 'next';
      actions.moveBranch(id, dir);
  };

  const setAllBranchesCollapsed = useCallback((collapsed: boolean) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const nextBranches = { ...p.branches };
      Object.keys(nextBranches).forEach(id => {
        nextBranches[id] = { ...nextBranches[id], collapsed };
      });
      return { ...p, branches: nextBranches };
    }));
  }, [activeProjectId, setProjects]);

  return (
    <BranchContext.Provider value={{
      selectedBranchId, selectBranch: setSelectedBranchId,
      showArchived, toggleShowArchived: () => setShowArchived(!showArchived),
      showAllProjects, toggleShowAllProjects: () => setShowAllProjects(!showAllProjects),
      ...actions,
      moveBranch: moveBranchMapped,
      setAllBranchesCollapsed
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used within a BranchProvider');
  return context;
};
