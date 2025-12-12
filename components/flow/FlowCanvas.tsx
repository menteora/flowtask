import React, { useRef, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import BranchNode from './BranchNode';

interface TreeLevelProps {
  branchId: string;
}

const TreeLevel: React.FC<TreeLevelProps> = ({ branchId }) => {
  const { state, showArchived } = useProject();
  const branch = state.branches[branchId];
  
  if (!branch) return null;

  // Archive Filter Logic:
  // If branch is archived AND we are NOT showing archived, do not render this node (or its children).
  if (branch.archived && !showArchived) {
      return null;
  }

  // Filter Children: Only pass down children that should be visible, or rely on recursion to hide them individually.
  // Recursion is cleaner, but if we want to remove the connecting lines, we need to know valid children ahead of time.
  const visibleChildrenIds = branch.childrenIds.filter(cid => {
      const child = state.branches[cid];
      if (!child) return false;
      return !child.archived || showArchived;
  });

  const hasChildren = visibleChildrenIds.length > 0;

  return (
    <div className={`flex flex-col items-center ${branch.archived ? 'opacity-60 grayscale' : ''}`}>
      {/* The Node itself */}
      <BranchNode branchId={branchId} />

      {/* Children Container */}
      {hasChildren && (
        <div className="relative flex items-start justify-center pt-4">
            {/* Horizontal connecting line logic */}
             
             {/* Only draw the horizontal connector bar if more than 1 child */}
             {visibleChildrenIds.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-600 mt-[1px]" 
                     style={{ 
                         // Logic handled by CSS layout usually, but visual tweaks here if needed
                     }}
                />
             )}

            {/* Render children */}
            <div className="flex gap-8 relative">
                 {/* The horizontal bar margin hack if needed */}
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
    // Only drag if clicking on the background (not on a button/node)
    // We assume buttons stopPropagation, but basic check helps
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setStartPos({
      x: e.pageX,
      y: e.pageY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    });
    
    // Deselect branch on background click
    selectBranch(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    
    const walkX = (e.pageX - startPos.x) * 1.5; // 1.5 multiplier for faster scroll
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
        {/* Inner container with min dimensions to ensure scrollability */}
        {/* Added ID for image export */}
        <div id="export-canvas-content" className="min-w-max min-h-full flex justify-center p-10 pb-40">
            <TreeLevel branchId={state.rootBranchId} />
        </div>
    </div>
  );
};

export default FlowCanvas;