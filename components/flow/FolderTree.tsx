import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { STATUS_CONFIG } from '../../constants';
import { ChevronRight, ChevronDown, Plus, FileText, CheckSquare, Square, Archive, GitBranch, ChevronUp, Tag } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface FolderNodeProps {
  branchId: string;
  depth?: number;
  index?: number;
  siblingsCount?: number;
}

const FolderNode: React.FC<FolderNodeProps> = ({ branchId, depth = 0, index, siblingsCount }) => {
  const { state, selectBranch, selectedBranchId, addBranch, updateTask, moveTask, moveBranch, showArchived, setEditingTask } = useProject();
  const branch = state.branches[branchId];
  const [isOpen, setIsOpen] = useState(true);

  if (!branch) return null;
  
  // Visibility Logic: Show if not archived OR showArchived=true OR has active children
  const isSelfVisible = !branch.archived || showArchived;
  const hasActiveChildren = branch.childrenIds.some(cid => {
      const child = state.branches[cid];
      return child && !child.archived;
  });

  const shouldRender = isSelfVisible || hasActiveChildren;

  if (!shouldRender) return null;

  // For children, we pass through everything and let the recursive call handle hiding
  const visibleChildrenIds = branch.childrenIds;

  const hasChildren = visibleChildrenIds.length > 0;
  const hasTasks = branch.tasks.length > 0;
  const hasContent = hasChildren || hasTasks;
  
  const isSelected = selectedBranchId === branchId;
  const statusConfig = STATUS_CONFIG[branch.status];

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = () => {
    selectBranch(branchId);
  };

  return (
    <div className={`flex flex-col select-none ${branch.archived ? 'opacity-60' : ''}`}>
      {/* Branch Row */}
      <div 
        className={`
          flex items-center gap-2 py-3 px-4 border-b border-gray-100 dark:border-slate-800 transition-colors cursor-pointer
          ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'}
        `}
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={handleSelect}
      >
        <button 
           onClick={handleToggle}
           className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${!hasContent ? 'invisible' : ''}`}
        >
           {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        <div className={`${branch.isLabel ? 'text-amber-500' : statusConfig.color} bg-transparent p-0 relative`}>
             {branch.isLabel ? <Tag className="w-5 h-5" /> : <GitBranch className="w-5 h-5" />}
             {branch.archived && (
                 <div className="absolute -bottom-1 -right-1 bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
                     <Archive className="w-2 h-2 text-gray-500" />
                 </div>
             )}
        </div>
        
        <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2">
                 <span className={`font-medium text-sm truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {branch.title}
                 </span>
                 {!branch.isLabel && (
                     <span className={`text-[10px] px-1.5 rounded-full border border-current opacity-70 ${statusConfig.color} bg-transparent`}>
                        {branch.status}
                     </span>
                 )}
                 {branch.isLabel && (
                     <span className="text-[10px] px-1.5 rounded-full border border-amber-300 text-amber-600 dark:text-amber-400 dark:border-amber-700 bg-transparent">
                        Label
                     </span>
                 )}
             </div>
        </div>

        <button 
            onClick={(e) => {
                e.stopPropagation();
                addBranch(branchId);
                setIsOpen(true);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-full"
        >
            <Plus className="w-4 h-4" />
        </button>

        {/* Mobile Branch Reordering Controls */}
        {index !== undefined && siblingsCount !== undefined && siblingsCount > 1 && (
            <div className="flex flex-col gap-1 border-l border-gray-200 dark:border-slate-700 pl-2 ml-1">
                {index > 0 ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'left'); }} // 'left' maps to UP in tree view
                        className="p-0.5 text-slate-400 hover:text-indigo-500"
                    >
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                ) : <div className="w-3.5 h-3.5 p-0.5"></div>}
                
                {index < siblingsCount - 1 ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'right'); }} // 'right' maps to DOWN in tree view
                        className="p-0.5 text-slate-400 hover:text-indigo-500"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                ) : <div className="w-3.5 h-3.5 p-0.5"></div>}
            </div>
        )}
      </div>

      {/* Children (Tasks & Sub-Branches) */}
      {isOpen && hasContent && (
        <div className="flex flex-col">
          {/* Tasks */}
          {branch.tasks.map((task, index) => (
             <div 
                key={task.id}
                className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/50 pr-2 group"
                style={{ paddingLeft: `${(depth + 1) * 1.5 + 2.5}rem` }}
             >
                <div className="text-gray-400">
                    <FileText className="w-4 h-4" />
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        updateTask(branchId, task.id, { completed: !task.completed });
                    }}
                    className={`${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-slate-600'}`}
                >
                    {task.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
                <div 
                    className="flex-1 min-w-0 flex items-center justify-between cursor-pointer"
                    onClick={() => setEditingTask({ branchId, taskId: task.id })}
                >
                    <span className={`text-sm truncate hover:text-indigo-600 dark:hover:text-indigo-400 ${task.completed ? 'line-through text-gray-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {task.title}
                    </span>
                    {task.assigneeId && (
                        <Avatar person={state.people.find(p => p.id === task.assigneeId)!} size="sm" className="w-5 h-5 text-[10px] mr-2" />
                    )}
                </div>

                {/* Mobile Task Reordering Controls */}
                <div className="flex flex-col gap-1 border-l border-gray-200 dark:border-slate-700 pl-2">
                    {index > 0 ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); moveTask(branchId, task.id, 'up'); }}
                            className="p-0.5 text-slate-400 hover:text-indigo-500"
                        >
                            <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                    ) : <div className="w-3.5 h-3.5 p-0.5"></div>}
                    
                    {index < branch.tasks.length - 1 ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); moveTask(branchId, task.id, 'down'); }}
                            className="p-0.5 text-slate-400 hover:text-indigo-500"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    ) : <div className="w-3.5 h-3.5 p-0.5"></div>}
                </div>
             </div>
          ))}

          {/* Sub Branches */}
          {visibleChildrenIds.map((childId, idx) => (
            <FolderNode 
                key={childId} 
                branchId={childId} 
                depth={depth + 1}
                index={idx}
                siblingsCount={visibleChildrenIds.length}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree: React.FC = () => {
  const { state } = useProject();
  
  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-slate-900 pb-20" id="export-tree-content">
      <FolderNode branchId={state.rootBranchId} />
    </div>
  );
};

export default FolderTree;