import React, { useRef, useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import BranchNode from './BranchNode';
import { Archive } from 'lucide-react';
import { Branch } from '../../types';

interface TreeLevelProps {
  branchId: string;
}

/**
 * Helper to determine if a branch or any of its descendants are visible
 * based on the current archival visibility settings.
 */
const isSubtreeVisible = (branchId: string, branches: Record<string, Branch>, showArchived: boolean): boolean => {
    const branch = branches[branchId];
    if (!branch) return false;
    
    // If we show archived, everything is visible
    if (showArchived) return true;
    
    // If this branch is not archived, it's visible
    if (!branch.archived) return true;
    
    // If this branch IS archived, it's only visible if at least one child is visible
    return branch.childrenIds.some(cid => isSubtreeVisible(cid, branches, showArchived));
};

const SkippedNodeIndicator: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex flex-col items-center group/skip relative">
        <div 
            className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors cursor-help"
            title={`Passaggio archiviato: ${title}`}
        >
            <Archive className="w-4 h-4" />
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
    </div>
);

const TreeLevel: React.FC<TreeLevelProps> = ({ branchId }) => {
  const { state, showArchived } = useProject();
  const branch = state.branches[branchId];
  
  if (!branch) return null;

  // Visibility Logic:
  const isNodeVisibleInCurrentView = !branch.archived || showArchived;
  
  // Check if we need to render this subtree at all
  const visibleSubtree = useMemo(() => isSubtreeVisible(branchId, state.branches, showArchived), [branchId, state.branches, showArchived]);

  if (!visibleSubtree) {
      return null;
  }

  const visibleChildrenIds = branch.childrenIds.filter(cid => isSubtreeVisible(cid, state.branches, showArchived));
  const hasVisibleChildren = visibleChildrenIds.length > 0;
  const isCollapsed = branch.collapsed;

  return (
    <div className="flex flex-col items-center">
      {/* The Node itself or a placeholder indicator */}
      {isNodeVisibleInCurrentView ? (
          <BranchNode branchId={branchId} />
      ) : (
          <SkippedNodeIndicator title={branch.title} />
      )}

      {/* Children Container */}
      {hasVisibleChildren && !isCollapsed && (
        <div className="relative flex items-start justify-center pt-4 animate-in fade-in zoom-in-95 duration-200 origin-top">
             {/* Horizontal connecting line logic */}
             {visibleChildrenIds.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-600 mt-[1px]" />
             )}

            {/* Render children */}
            <div className="flex gap-8 relative">
                 {visibleChildrenIds.length > 1 && (
                     <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-600 -translate-y-4 mx-[calc(8rem)]" /> 
                 )}
                 
                 {visibleChildrenIds.map((childId, index) => (
                    <div key={childId} className="flex flex-col items-center relative">
                         {/* Horizontal connector segments */}
                         {visibleChildrenIds.length > 1 && (
                             <>
                                {index > 0 && <div className="absolute -top-4 right-1/2 w-[calc(50%+1rem)] h-px bg-slate-300 dark:bg-slate-600"></div>}
                                {index < visibleChildrenIds.length - 1 && <div className="absolute -top-4 left-1/2 w-[calc(50%+1rem)] h-px bg-slate-300 dark:bg-slate-600"></div>}
                             </>
                         )}

                        <TreeLevel branchId={childId} />
                    </div>
                 ))}
            </div>
        </div>
      )}
    </div>
  );
};

const FlowCanvas: React.FC = () => {
  const { state, selectBranch } = useProject();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    // Check if we are clicking directly on the canvas background
    const target = e.target as HTMLElement;
    if (target.id === 'export-canvas-content' || target === containerRef.current) {
        setIsDragging(true);
        setStartPos({
          x: e.pageX,
          y: e.pageY,
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop
        });
        
        selectBranch(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    
    const walkX = (e.pageX - startPos.x) * 1.5;
    const walkY = (e.pageY - startPos.y) * 1.5;
    
    containerRef.current.scrollLeft = startPos.scrollLeft - walkX;
    containerRef.current.scrollTop = startPos.scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full overflow-auto bg-slate-50 dark:bg-slate-950 relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
    >
        <div id="export-canvas-content" className="min-w-max min-h-full flex justify-center p-10 pb-40">
            <TreeLevel branchId={state.rootBranchId} />
        </div>
    </div>
  );
};

export default FlowCanvas;