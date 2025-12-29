import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { STATUS_CONFIG } from '../../constants';
import { ChevronRight, ChevronDown, Plus, FileText, CheckSquare, Square, Archive, GitBranch, ChevronUp, Tag, Calendar, CheckCircle2, ChevronsDown, ChevronsUp, Layers, RefreshCw } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface FolderNodeProps {
  branchId: string;
  depth?: number;
  index?: number;
  siblingsCount?: number;
}

const FolderNode: React.FC<FolderNodeProps> = ({ branchId, depth = 0, index, siblingsCount }) => {
  const { state, selectBranch, selectedBranchId, addBranch, updateTask, updateBranch, moveTask, moveBranch, showArchived, showOnlyOpen, setEditingTask, setReadingTask, pendingSyncIds } = useProject();
  const branch = state.branches[branchId];
  
  if (!branch) return null;
  
  const isSyncing = pendingSyncIds.has(branchId);

  const isSelfVisible = !branch.archived || showArchived;
  const hasActiveChildren = branch.childrenIds.some(cid => {
      const child = state.branches[cid];
      return child && !child.archived;
  });

  const shouldRender = isSelfVisible || hasActiveChildren;

  if (!shouldRender) return null;

  const sortedTasks = useMemo(() => {
    let list = [...branch.tasks];
    if (showOnlyOpen) {
        list = list.filter(t => !t.completed);
    }
    return list.sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });
  }, [branch.tasks, showOnlyOpen]);

  const visibleChildrenIds = branch.childrenIds;
  const hasChildren = visibleChildrenIds.length > 0;
  const hasTasks = sortedTasks.length > 0;
  const hasContent = hasChildren || hasTasks;
  
  const isSelected = selectedBranchId === branchId;
  const statusConfig = STATUS_CONFIG[branch.status];
  const isOpen = !branch.collapsed;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateBranch(branchId, { collapsed: !branch.collapsed });
  };

  const handleSelect = () => {
    selectBranch(branchId);
  };

  return (
    <div className={`flex flex-col select-none ${branch.archived ? 'opacity-60' : ''} ${isSyncing ? 'bg-indigo-50/20' : ''}`}>
      <div 
        className={`
          flex items-center gap-2 py-3 px-4 border-b border-gray-100 dark:border-slate-800 transition-colors cursor-pointer relative
          ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'}
        `}
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={handleSelect}
      >
        {isSyncing && (
            <div className="absolute left-1 top-1/2 -translate-y-1/2">
                <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
            </div>
        )}

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
             </div>
        </div>

        <button 
            onClick={(e) => {
                e.stopPropagation();
                updateBranch(branchId, { collapsed: false });
                addBranch(branchId);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-full"
        >
            <Plus className="w-4 h-4" />
        </button>
      </div>

      {isOpen && hasContent && (
        <div className="flex flex-col">
          {sortedTasks.map((task, index) => {
             const taskSyncing = pendingSyncIds.has(task.id);
             return (
                 <div 
                    key={task.id}
                    className={`flex items-center gap-3 py-2 border-b border-gray-50 dark:border-slate-800/50 pr-2 group ${taskSyncing ? 'bg-indigo-50/10' : 'bg-gray-50/50 dark:bg-slate-900/50'}`}
                    style={{ paddingLeft: `${(depth + 1) * 1.5 + 2.5}rem` }}
                 >
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            updateTask(branchId, task.id, { completed: !task.completed });
                        }}
                        className={`${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-slate-600'}`}
                        disabled={taskSyncing}
                    >
                        {taskSyncing ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : (task.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />)}
                    </button>
                    
                    <div 
                        className="flex-1 min-w-0 flex items-center justify-between cursor-pointer"
                        onClick={() => setEditingTask({ branchId, taskId: task.id })}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-sm truncate hover:text-indigo-600 dark:hover:text-indigo-400 ${task.completed ? 'line-through text-gray-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                {task.title}
                            </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                            {task.assigneeId && (
                                <Avatar person={state.people.find(p => p.id === task.assigneeId)!} size="sm" className="w-5 h-5 text-[10px] mr-2" />
                            )}
                        </div>
                    </div>
                 </div>
             );
          })}

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
    const { state, setAllBranchesCollapsed } = useProject();
    const branchesCount = Object.keys(state.branches).length - 1;

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-950">
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-indigo-600/10 p-1.5 rounded-lg">
                        <Layers className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">Gerarchia</span>
                        <span className="text-[10px] text-slate-400 font-bold">{branchesCount} rami attivi</span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => setAllBranchesCollapsed(false)} className="p-2 text-indigo-600 dark:text-indigo-400 rounded-lg"><ChevronsDown className="w-4 h-4" /></button>
                    <button onClick={() => setAllBranchesCollapsed(true)} className="p-2 text-slate-500 rounded-lg"><ChevronsUp className="w-4 h-4" /></button>
                </div>
            </div>

            <div id="export-tree-content" className="flex-1 overflow-y-auto pb-24">
                <FolderNode branchId={state.rootBranchId} />
            </div>
        </div>
    );
};

export default FolderTree;