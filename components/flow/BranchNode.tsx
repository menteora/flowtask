
import React, { useState, useEffect, useMemo } from 'react';
import { Branch, BranchStatus } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { useProject } from '../../context/ProjectContext';
import { MoreHorizontal, Plus, Calendar, Archive, ChevronLeft, ChevronRight, FileText, ChevronDown, ChevronUp, GitMerge, Globe, Tag, Eye, EyeOff, CheckCircle2, Zap } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface BranchNodeProps {
  branchId: string;
}

const BranchNode: React.FC<BranchNodeProps> = ({ branchId }) => {
  const { state, addBranch, selectBranch, selectedBranchId, moveBranch, setReadingDescriptionId, updateBranch, setReadingTask, showOnlyOpen } = useProject();
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  const branch = state.branches[branchId];
  
  const isInactive = branch?.status === BranchStatus.CLOSED || branch?.status === BranchStatus.CANCELLED;
  const [isDetailsOpen, setIsDetailsOpen] = useState(!isInactive);

  useEffect(() => {
      if (branch) {
        const inactive = branch.status === BranchStatus.CLOSED || branch.status === BranchStatus.CANCELLED;
        setIsDetailsOpen(!inactive);
      }
  }, [branch?.status]);

  const sortedTasks = useMemo(() => {
    if (!branch) return [];
    let list = [...branch.tasks];
    if (showOnlyOpen) {
        list = list.filter(t => !t.completed);
    }
    return list.sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });
  }, [branch?.tasks, showOnlyOpen]);

  if (!branch) return null;

  const isSelected = selectedBranchId === branchId;
  const totalTasks = branch.tasks.length;
  const completedTasks = branch.tasks.filter(t => t.completed).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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
  const isMultiParent = branch.parentIds.length > 1;
  const isImported = branch.title.includes('(Importato)');

  const visibleTasks = isTasksExpanded ? sortedTasks : sortedTasks.slice(0, 3);
  const hiddenTasksCount = sortedTasks.length > 3 ? sortedTasks.length - 3 : 0;

  if (branch.isLabel || branch.isSprint) {
      const isSprint = branch.isSprint;
      return (
        <div className="flex flex-col items-center group/node">
            <div 
                className={`
                  relative w-56 rounded-lg shadow-sm border-2 transition-all duration-200 cursor-pointer hover:shadow-md
                  flex flex-col
                  ${isSelected 
                    ? (isSprint ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-400 ring-2 ring-indigo-400/20' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-400 ring-2 ring-amber-400/20') 
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-700'}
                  ${branch.archived ? 'border-dashed opacity-70 grayscale' : ''}
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  selectBranch(branchId);
                }}
            >
                <div className="p-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {isSprint ? (
                            <Zap className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        ) : (
                            <Tag className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                        )}
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={branch.title}>
                            {branch.title}
                        </span>
                    </div>
                </div>

                {hasDescription && (
                    <div className="px-2 pb-1 flex justify-end">
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setReadingDescriptionId(branchId);
                            }}
                            className="text-slate-400 hover:text-indigo-500"
                         >
                             <FileText className="w-3 h-3" />
                         </button>
                    </div>
                )}

                {(canMoveLeft || canMoveRight) && (
                    <div className="absolute -top-3 right-0 left-0 flex justify-center opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm flex pointer-events-auto">
                            <button onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'left'); }} disabled={!canMoveLeft} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l-full disabled:opacity-30"><ChevronLeft className="w-3 h-3" /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'right'); }} disabled={!canMoveRight} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-r-full disabled:opacity-30"><ChevronRight className="w-3 h-3" /></button>
                        </div>
                    </div>
                )}

                {hasChildren && (
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateBranch(branchId, { collapsed: !branch.collapsed });
                            }}
                            className="w-5 h-5 rounded-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors"
                        >
                            {branch.collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        </button>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
            
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    if (branch.collapsed) updateBranch(branchId, { collapsed: false });
                    addBranch(branchId);
                }}
                className="w-5 h-5 rounded-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors z-10"
                title="Aggiungi sotto-ramo"
            >
                <Plus className="w-3 h-3" />
            </button>
            
            {!branch.collapsed && branch.childrenIds.length > 0 && (
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
            )}
        </div>
      );
  }

  const statusConfig = STATUS_CONFIG[branch.status];

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
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" title={`Multi-Link`}>
                        <GitMerge className="w-3 h-3" />
                    </span>
                )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
             {hasDescription && (
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setReadingDescriptionId(branchId);
                    }}
                    className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 transition-colors"
                 >
                     <FileText className="w-4 h-4" />
                 </button>
             )}
             {(canMoveLeft || canMoveRight) && (
                <div className="flex bg-slate-50 dark:bg-slate-900/50 rounded-lg p-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'left'); }} disabled={!canMoveLeft} className="p-0.5 hover:bg-white dark:hover:bg-slate-800 rounded disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'right'); }} disabled={!canMoveRight} className="p-0.5 hover:bg-white dark:hover:bg-slate-800 rounded disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
             )}
          </div>
        </div>

        {isDetailsOpen ? (
            <div className="p-3 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold uppercase tracking-tighter">
                    <span>Progressi</span>
                    <span>{completedTasks}/{totalTasks}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${branch.archived ? 'bg-slate-400' : 'bg-indigo-500'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                
                <ul className="mt-2 space-y-1.5">
                    {visibleTasks.map(task => {
                        const assignee = task.assigneeId ? state.people.find(p => p.id === task.assigneeId) : null;
                        return (
                            <li key={task.id} className="text-[11px] flex items-center justify-between gap-2 py-0.5">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${task.completed ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                    <span className={`truncate text-slate-600 dark:text-slate-300 ${task.completed ? 'line-through opacity-60' : ''}`}>
                                        {task.title}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {task.completed && task.completedAt ? (
                                        <div className="flex items-center text-green-500" title={`Chiuso il: ${new Date(task.completedAt).toLocaleDateString()}`}>
                                            <CheckCircle2 className="w-3 h-3" />
                                        </div>
                                    ) : task.dueDate ? (
                                        <div className={`flex items-center gap-0.5 px-1 rounded-sm text-[8px] font-black ${new Date(task.dueDate) < new Date() ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                            <Calendar className="w-2.5 h-2.5" />
                                            <span>{new Date(task.dueDate).getDate()}/{new Date(task.dueDate).getMonth() + 1}</span>
                                        </div>
                                    ) : null}
                                    {assignee && <Avatar person={assignee} size="sm" className="w-4 h-4 text-[7px]" />}
                                </div>
                            </li>
                        );
                    })}
                    
                    {!isTasksExpanded && hiddenTasksCount > 0 && (
                        <li 
                            className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium pl-3 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setIsTasksExpanded(true); }}
                        >
                            + altri {hiddenTasksCount} task
                        </li>
                    )}
                </ul>

                {isInactive && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsDetailsOpen(false); }}
                        className="w-full text-[10px] text-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded flex items-center justify-center gap-1 transition-colors mt-2"
                    >
                        <EyeOff className="w-3 h-3" /> Nascondi
                    </button>
                )}
            </div>
        ) : (
            <div 
                className="p-2 flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsDetailsOpen(true); }}
            >
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                    <Eye className="w-3 h-3" /> Mostra {branch.tasks.length} task...
                </div>
            </div>
        )}

        {hasChildren && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        updateBranch(branchId, { collapsed: !branch.collapsed });
                    }}
                    className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors"
                 >
                     {branch.collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                 </button>
            </div>
        )}
      </div>

      <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
      
      <button 
        onClick={(e) => {
            e.stopPropagation();
            if (branch.collapsed) updateBranch(branchId, { collapsed: false });
            addBranch(branchId);
        }}
        className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-500 flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 transition-colors z-10"
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
