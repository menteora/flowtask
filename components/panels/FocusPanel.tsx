import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { Target, Star, CheckSquare, Square, ArrowRight, Folder, Pin, FileText } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface PinnedTaskItem {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate?: string;
    branchId: string;
    branchTitle: string;
    projectId: string;
    projectName: string;
    assigneeId?: string;
}

const FocusPanel: React.FC = () => {
    const { state, projects, showAllProjects, updateTask, selectBranch, switchProject, setEditingTask, setReadingTask } = useProject();

    // Gather pinned tasks based on toggle state
    const pinnedTasks = useMemo(() => {
        const tasks: PinnedTaskItem[] = [];
        
        // If showAllProjects is true, use all open projects. Otherwise, only current active project.
        const sourceProjects = showAllProjects ? projects : [state];
        
        sourceProjects.forEach(project => {
            (Object.values(project.branches) as Branch[]).forEach(branch => {
                if (branch.archived) return; // Skip archived branches

                branch.tasks.forEach(task => {
                    if (task.pinned && !task.completed) {
                        tasks.push({
                            id: task.id,
                            title: task.title,
                            description: task.description,
                            completed: task.completed,
                            dueDate: task.dueDate,
                            branchId: branch.id,
                            branchTitle: branch.title,
                            projectId: project.id,
                            projectName: project.name,
                            assigneeId: task.assigneeId
                        });
                    }
                });
            });
        });

        // Sort by Due Date (urgent first), then project
        return tasks.sort((a, b) => {
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            return a.projectName.localeCompare(b.projectName);
        });
    }, [projects, state, showAllProjects]);

    return (
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Target className="w-8 h-8 text-amber-500" />
                    Focus & Priorità
                    {showAllProjects && <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full ml-2">Tutti i progetti</span>}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    I task che hai pinnato per un accesso rapido.
                </p>
            </div>

            {pinnedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                        <Pin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Nessun task in focus</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                        Usa l'icona <Pin className="w-3 h-3 inline" /> nei dettagli dei rami per aggiungere task qui.
                        {!showAllProjects && projects.length > 1 && <br/>}
                        {!showAllProjects && projects.length > 1 && <span className="opacity-70 text-xs">(Attiva la vista globale 🌍 per vedere i pin di altri progetti)</span>}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pinnedTasks.map(task => {
                        const isForeign = task.projectId !== state.id;
                        // Find assignee in current state (might be missing if foreign project not loaded fully in context, but `projects` array has data)
                        const project = projects.find(p => p.id === task.projectId);
                        const assignee = project?.people.find(p => p.id === task.assigneeId);

                        return (
                            <div key={task.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center gap-4 group transition-all hover:border-amber-300 dark:hover:border-amber-700">
                                {/* Checkbox */}
                                <button 
                                    onClick={() => {
                                        if (isForeign) {
                                            switchProject(task.projectId);
                                        } else {
                                            updateTask(task.branchId, task.id, { completed: true });
                                        }
                                    }}
                                    className={`shrink-0 ${isForeign ? 'text-slate-300 dark:text-slate-600' : 'text-slate-300 hover:text-green-500 dark:text-slate-600 dark:hover:text-green-400'} transition-colors`}
                                    title={isForeign ? "Vai al progetto per completare" : "Completa Task"}
                                >
                                    <Square className="w-6 h-6" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 
                                            className="font-bold text-slate-800 dark:text-white truncate cursor-pointer hover:underline"
                                            onClick={() => {
                                                if (isForeign) {
                                                    switchProject(task.projectId);
                                                    setTimeout(() => setEditingTask({ branchId: task.branchId, taskId: task.id }), 100);
                                                } else {
                                                    setEditingTask({ branchId: task.branchId, taskId: task.id });
                                                }
                                            }}
                                        >
                                            {task.title}
                                        </h3>
                                        {task.description && task.description.trim() !== '' && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if(isForeign) switchProject(task.projectId);
                                                    setTimeout(() => setReadingTask({ branchId: task.branchId, taskId: task.id }), isForeign ? 100 : 0);
                                                }}
                                                className="text-slate-400 hover:text-indigo-500"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {showAllProjects && (
                                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200 dark:border-slate-600">
                                                <Folder className="w-3 h-3" /> {task.projectName}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        <span 
                                            className="flex items-center gap-1 hover:text-indigo-500 cursor-pointer"
                                            onClick={() => {
                                                if (isForeign) switchProject(task.projectId);
                                                setTimeout(() => selectBranch(task.branchId), isForeign ? 100 : 0);
                                            }}
                                        >
                                            <ArrowRight className="w-3 h-3" /> {task.branchTitle}
                                        </span>
                                        
                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-500 font-bold' : 'text-amber-600'}`}>
                                                <Star className="w-3 h-3" /> 
                                                Scad: {new Date(task.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 justify-between md:justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-700 pt-3 md:pt-0">
                                    {assignee && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-full">
                                            <Avatar person={assignee} size="sm" />
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{assignee.name}</span>
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={() => {
                                            if (isForeign) {
                                                switchProject(task.projectId);
                                            } else {
                                                updateTask(task.branchId, task.id, { pinned: false });
                                            }
                                        }}
                                        className="p-2 text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-full transition-colors"
                                        title="Rimuovi da Focus (Unpin)"
                                    >
                                        <Pin className="w-4 h-4 fill-current" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FocusPanel;