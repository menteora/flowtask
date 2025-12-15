import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { CheckSquare, Square, ClipboardList, HelpCircle, ArrowRight, Calendar, Mail, MessageCircle } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface UserTaskGroup {
  userId: string;
  userName: string;
  person?: any;
  tasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    dueDate?: string;
    branchId: string;
    branchTitle: string;
  }>;
  stats: {
    total: number;
    completed: number;
    percentage: number;
  };
}

const UserTasksPanel: React.FC = () => {
  const { state, updateTask, selectBranch, showArchived, setEditingTask, setRemindingUserId } = useProject();

  const taskGroups = useMemo(() => {
    const groups: Record<string, UserTaskGroup> = {};

    // Initialize groups for existing people
    state.people.forEach(person => {
      groups[person.id] = {
        userId: person.id,
        userName: person.name,
        person: person,
        tasks: [],
        stats: { total: 0, completed: 0, percentage: 0 }
      };
    });

    // Initialize Unassigned group
    groups['unassigned'] = {
      userId: 'unassigned',
      userName: 'Non Assegnati',
      tasks: [],
      stats: { total: 0, completed: 0, percentage: 0 }
    };

    // Iterate branches and tasks
    (Object.values(state.branches) as Branch[]).forEach(branch => {
      if (branch.archived && !showArchived) return;

      branch.tasks.forEach(task => {
        const assigneeId = task.assigneeId && groups[task.assigneeId] ? task.assigneeId : 'unassigned';
        
        groups[assigneeId].tasks.push({
          id: task.id,
          title: task.title,
          completed: task.completed,
          dueDate: task.dueDate,
          branchId: branch.id,
          branchTitle: branch.title
        });
      });
    });

    // Calculate stats and sort tasks by date/completion
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1; // Completed last
      });
      
      group.stats.total = group.tasks.length;
      group.stats.completed = group.tasks.filter(t => t.completed).length;
      group.stats.percentage = group.stats.total > 0 
        ? Math.round((group.stats.completed / group.stats.total) * 100) 
        : 0;
    });

    // Return as array, putting Unassigned last
    const result = Object.values(groups).filter(g => g.userId !== 'unassigned');
    if (groups['unassigned'].tasks.length > 0) {
        result.push(groups['unassigned']);
    }
    
    return result;
  }, [state.branches, state.people, showArchived]);

  return (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            Task per Utente
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
            Visualizza il carico di lavoro e lo stato di avanzamento per ogni membro del team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {taskGroups.map(group => {
            const isUnassigned = group.userId === 'unassigned';
            
            // Skip showing users with 0 tasks if you want a cleaner view, 
            // but usually seeing empty states is good for assignment.
            // Let's keep them but maybe dim them if empty?
            const isEmpty = group.stats.total === 0;

            return (
                <div key={group.userId} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden ${isEmpty ? 'opacity-70' : ''}`}>
                    {/* Card Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {isUnassigned ? (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                        <HelpCircle className="w-5 h-5" />
                                    </div>
                                ) : (
                                    <Avatar person={group.person} size="lg" className="shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 dark:text-white truncate">{group.userName}</h3>
                                    {!isUnassigned && (
                                        <div className="flex flex-col">
                                            {group.person.email && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {group.person.email}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {group.stats.completed} / {group.stats.total} completati
                                    </p>
                                </div>
                            </div>
                            <div className="text-right pl-2 flex flex-col items-end gap-1">
                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{group.stats.percentage}%</span>
                                {!isUnassigned && (
                                    <button 
                                        onClick={() => setRemindingUserId(group.userId)}
                                        className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                                        title="Invia Sollecito"
                                    >
                                        <MessageCircle className="w-3 h-3" /> Contatta
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${isUnassigned ? 'bg-slate-400' : 'bg-indigo-500'}`}
                                style={{ width: `${group.stats.percentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Task List */}
                    <div className="flex-1 p-0 overflow-y-auto max-h-[400px]">
                        {group.tasks.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm italic">
                                Nessun task assegnato.
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {group.tasks.map(task => (
                                    <li key={task.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <button 
                                                onClick={() => updateTask(task.branchId, task.id, { completed: !task.completed })}
                                                className={`mt-0.5 flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-500 hover:text-indigo-500'}`}
                                            >
                                                {task.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                            </button>
                                            
                                            <div className="flex-1 min-w-0">
                                                <p 
                                                    className={`text-sm font-medium mb-0.5 cursor-pointer hover:underline ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                    onClick={() => setEditingTask({ branchId: task.branchId, taskId: task.id })}
                                                    title="Modifica Task"
                                                >
                                                    {task.title}
                                                </p>
                                                
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span 
                                                        className="flex items-center gap-1 hover:text-indigo-500 cursor-pointer transition-colors max-w-[150px] truncate"
                                                        onClick={() => selectBranch(task.branchId)}
                                                        title="Vai al ramo"
                                                    >
                                                        <ArrowRight className="w-3 h-3" />
                                                        {task.branchTitle}
                                                    </span>
                                                    
                                                    {task.dueDate && (
                                                        <span className={`flex items-center gap-1 ${task.completed ? '' : 'text-amber-600 dark:text-amber-500'}`}>
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(task.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit'})}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default UserTasksPanel;
