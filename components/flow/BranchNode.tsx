import React from 'react';
import { Branch, BranchStatus } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { useProject } from '../../context/ProjectContext';
import { MoreHorizontal, Plus, Calendar, Archive, ChevronLeft, ChevronRight, FileText, ChevronDown, ChevronUp, GitMerge, Globe } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface BranchNodeProps {
  branchId: string;
}

const BranchNode: React.FC<BranchNodeProps> = ({ branchId }) => {
  const { state, addBranch, selectBranch, selectedBranchId, moveBranch, setReadingDescriptionId, updateBranch } = useProject();
  const branch = state.branches[branchId];
  
  if (!branch) return null;

  const statusConfig = STATUS_CONFIG[branch.status];
  const isSelected = selectedBranchId === branchId;

  // Stats
  const totalTasks = branch.tasks.length;
  const completedTasks = branch.tasks.filter(t => t.completed).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Check movement possibilities (simplified to first parent)
  let canMoveLeft = false;
  let canMoveRight = false;
  
  if (branch.parentIds.length > 0) {
      const firstParent = state.branches[branch.parentIds[0]];
      if (firstParent) {
          const idx = firstParent.childrenIds.indexOf(branchId);
          if (idx > 0) canMoveLeft = true;
          if (idx !== -1 && idx < firstParent.childrenIds.length - 1) canMoveRight = true;
      }
  }

  const hasDescription = branch.description && branch.description.trim().length > 0;
  const hasChildren = branch.childrenIds.length > 0;
  
  // Indicators
  const isMultiParent = branch.parentIds.length > 1;
  const isImported = branch.title.includes('(Importato)');

  return (
    <div className="flex flex-col items-center group/node">
      <div 
        className={`
          relative w-72 bg-white dark:bg-slate-800 rounded-xl shadow-sm border-2 
          transition-all duration-200 cursor-pointer hover:shadow-md
          ${isSelected 
            ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-500'}
          ${branch.archived ? 'border-dashed opacity-80' : ''}
        `}
        onClick={(e) => {
          e.stopPropagation();
          selectBranch(branchId);
        }}
      >
        {/* Header */}
        <div className={`p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start ${branch.archived ? 'bg-slate-50 dark:bg-slate-800' : ''} relative`}>
          
          <div className="flex flex-col gap-1 overflow-hidden flex-1 min-w-0 pr-1">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm flex items-center gap-2" title={branch.title}>
              {branch.title}
              {branch.archived && <Archive className="w-3 h-3 text-slate-400" />}
            </h3>
            
            <div className="flex flex-wrap gap-1 items-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${statusConfig.color}`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
                
                {isMultiParent && (
                    <span 
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
                        title={`Multi-Link: Questo ramo ha ${branch.parentIds.length} genitori nel grafico.`}
                    >
                        <GitMerge className="w-3 h-3" />
                    </span>
                )}
                
                {isImported && (
                    <span 
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800" 
                        title="Ramo importato (Esterno)"
                    >
                        <Globe className="w-3 h-3" />
                    </span>
                )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
             {/* Description Reader Icon */}
             {hasDescription && (
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setReadingDescriptionId(branchId);
                    }}
                    className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 transition-colors"
                    title="Leggi descrizione"
                 >
                     <FileText className="w-4 h-4" />
                 </button>
             )}

             {/* Left Arrow */}
             {canMoveLeft && (
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        moveBranch(branchId, 'left');
                    }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 opacity-0 group-hover/node:opacity-100 transition-opacity"
                    title="Sposta a sinistra"
                 >
                     <ChevronLeft className="w-4 h-4" />
                 </button>
             )}
             
             {/* Right Arrow */}
             {canMoveRight && (
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        moveBranch(branchId, 'right');
                    }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 opacity-0 group-hover/node:opacity-100 transition-opacity"
                    title="Sposta a destra"
                 >
                     <ChevronRight className="w-4 h-4" />
                 </button>
             )}
             
             {branch.parentIds.length > 0 && (
                <div className="text-slate-400 pl-1">
                    <MoreHorizontal className="w-4 h-4" />
                </div>
            )}
          </div>

        </div>

        {/* Body */}
        <div className="p-3 space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Tasks</span>
                <span>{completedTasks}/{totalTasks}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${branch.archived ? 'bg-slate-400' : 'bg-indigo-500'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            {/* Quick Task Preview (Top 3) */}
            <ul className="mt-2 space-y-2">
                {branch.tasks.slice(0, 3).map(task => {
                    const assignee = task.assigneeId ? state.people.find(p => p.id === task.assigneeId) : null;
                    return (
                        <li key={task.id} className="text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${task.completed ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                <span className={`truncate text-slate-600 dark:text-slate-300 ${task.completed ? 'line-through opacity-60' : ''}`}>
                                    {task.title}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {task.dueDate && (
                                    <div className="flex items-center gap-0.5 text-[10px] text-slate-400" title={`Scadenza: ${task.dueDate}`}>
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(task.dueDate).getDate()}/{new Date(task.dueDate).getMonth() + 1}</span>
                                    </div>
                                )}
                                {assignee && (
                                    <Avatar person={assignee} size="sm" className="w-4 h-4 text-[8px]" />
                                )}
                            </div>
                        </li>
                    );
                })}
                {branch.tasks.length > 3 && (
                    <li className="text-[10px] text-slate-400 pl-3">
                        + altri {branch.tasks.length - 3} tasks
                    </li>
                )}
                {branch.tasks.length === 0 && (
                    <li className="text-[10px] text-slate-400 italic pl-1">Nessun task</li>
                )}
            </ul>
        </div>

        {/* Collapse Toggle Button (Bottom of card) */}
        {hasChildren && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        updateBranch(branchId, { collapsed: !branch.collapsed });
                    }}
                    className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors"
                    title={branch.collapsed ? "Espandi" : "Comprimi"}
                 >
                     {branch.collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                 </button>
            </div>
        )}
      </div>

      {/* Add Child Button (Visual connector) */}
      <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
      
      {/* Only show Plus button if NOT collapsed (or handle it differently? Usually you can add even if collapsed, but visually it's weird. Let's keep it visible but below) */}
      <button 
        onClick={(e) => {
            e.stopPropagation();
            // If collapsed, expand first?
            if (branch.collapsed) updateBranch(branchId, { collapsed: false });
            addBranch(branchId);
        }}
        className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors z-10"
        title="Aggiungi sotto-ramo"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      
      {!branch.collapsed && branch.childrenIds.length > 0 && (
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
      )}
    </div>
  );
};

export default BranchNode;