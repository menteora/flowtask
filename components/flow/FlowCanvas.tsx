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

  // Visibility Logic:
  // 1. If showArchived is ON, show everything.
  // 2. If branch is NOT archived, show it.
  // 3. If branch IS archived, but has visible children (active), show it as a "ghost" connector.
  const isSelfVisible = !branch.archived || showArchived;
  const hasActiveChildren = branch.childrenIds.some(cid => {
      const child = state.branches[cid];
      return child && !child.archived;
  });

  const shouldRender = isSelfVisible || hasActiveChildren;

  if (!shouldRender) {
      return null;
  }

  // Determine children to render
  const visibleChildrenIds = branch.childrenIds.filter(cid => {
      const child = state.branches[cid];
      if (!child) return false;
      // Show child if it is visible OR if it serves as a connector to active grandchildren
      // For performance, we limit lookahead to 1 level here, or rely on TreeLevel recursion handling it (rendering null)
      // Since map renders TreeLevel, passing the ID is safe, TreeLevel will return null if needed.
      return true; 
  });

  const hasChildren = visibleChildrenIds.length > 0;
  const isCollapsed = branch.collapsed;

  return (
    <div className={`flex flex-col items-center ${branch.archived ? 'opacity-60 grayscale' : ''}`}>
      {/* The Node itself */}
      <BranchNode branchId={branchId} />

      {/* Children Container */}
      {hasChildren && !isCollapsed && (
        <div className="relative flex items-start justify-center pt-4 animate-in fade-in zoom-in-95 duration-200 origin-top">
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