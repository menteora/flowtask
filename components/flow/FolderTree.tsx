import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { STATUS_CONFIG } from '../../constants';
import { ChevronRight, ChevronDown, Plus, FileText, CheckSquare, Square, Archive, GitBranch } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface FolderNodeProps {
  branchId: string;
  depth?: number;
}

const FolderNode: React.FC<FolderNodeProps> = ({ branchId, depth = 0 }) => {
  const { state, selectBranch, selectedBranchId, addBranch, updateTask, showArchived } = useProject();
  const branch = state.branches[branchId];
  const [isOpen, setIsOpen] = useState(true);

  if (!branch) return null;
  
  if (branch.archived && !showArchived) return null;

  const visibleChildrenIds = branch.childrenIds.filter(cid => {
      const child = state.branches[cid];
      return child && (!child.archived || showArchived);
  });

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

        <div className={`${statusConfig.color} bg-transparent p-0 relative`}>
             <GitBranch className="w-5 h-5" />
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
                 <span className={`text-[10px] px-1.5 rounded-full border border-current opacity-70 ${statusConfig.color} bg-transparent`}>
                    {branch.status}
                 </span>
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
      </div>

      {/* Children (Tasks & Sub-Branches) */}
      {isOpen && hasContent && (
        <div className="flex flex-col">
          {/* Tasks */}
          {branch.tasks.map(task => (
             <div 
                key={task.id}
                className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/50"
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
                <div className="flex-1 min-w-0 flex items-center justify-between pr-4">
                    <span className={`text-sm truncate ${task.completed ? 'line-through text-gray-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {task.title}
                    </span>
                    {task.assigneeId && (
                        <Avatar person={state.people.find(p => p.id === task.assigneeId)!} size="sm" className="w-5 h-5 text-[10px]" />
                    )}
                </div>
             </div>
          ))}

          {/* Sub Branches */}
          {visibleChildrenIds.map(childId => (
            <FolderNode key={childId} branchId={childId} depth={depth + 1} />
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