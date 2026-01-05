
import React, { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { useTask } from '../../context/TaskContext';
import { Branch, Person } from '../../types';
import { CheckSquare, Square, ClipboardList, HelpCircle, ArrowRight, Calendar, Mail, MessageCircle, FileText, Folder, Pin, X, User, CheckCircle2 } from 'lucide-react';
import Avatar from '../ui/Avatar';

// Interface for the aggregated group
interface AggregatedUserGroup {
  key: string; // Normalized name or 'unassigned'
  displayName: string;
  // All profiles matching this name across projects
  profiles: Array<Person & { projectId: string; projectName: string }>; 
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    completedAt?: string;
    dueDate?: string;
    branchId: string;
    branchTitle: string;
    projectId: string;
    projectName: string;
    pinned?: boolean;
    originalAssigneeId: string;
  }>;
  stats: {
    total: number;
    completed: number;
    percentage: number;
  };
}

const UserTasksPanel: React.FC = () => {
  const { state, projects, switchProject } = useProject();
  // Using BranchContext and TaskContext for specific states and actions
  const { showAllProjects, selectBranch, showArchived } = useBranch();
  const { updateTask, showOnlyOpen, setEditingTask, setRemindingUserId, setReadingTask } = useTask();
  
  // State for resolving contact conflicts (same name, different emails/phones)
  const [conflictGroup, setConflictGroup] = useState<AggregatedUserGroup | null>(null);

  const taskGroups = useMemo(() => {
    const groups: Record<string, AggregatedUserGroup> = {};
    const sourceProjects = showAllProjects ? projects : [state];
    
    // Map to track which original ID maps to which normalized name key
    const idToKeyMap: Record<string, string> = {};

    // 1. Collect People & Normalize
    sourceProjects.forEach(proj => {
        proj.people.forEach(person => {
            // Normalize: " Mario Rossi " -> "mario rossi"
            const normalizedKey = person.name.trim().toLowerCase();
            const compositeKey = normalizedKey; // We use name as the unique aggregator
            
            // Map the specific project-person-id to this group key
            idToKeyMap[`${proj.id}-${person.id}`] = compositeKey;

            if (!groups[compositeKey]) {
                groups[compositeKey] = {
                    key: compositeKey,
                    displayName: person.name, // Take the first name encountered as display
                    profiles: [],
                    tasks: [],
                    stats: { total: 0, completed: 0, percentage: 0 }
                };
            }
            
            // Add specific profile details
            groups[compositeKey].profiles.push({
                ...person,
                projectId: proj.id,
                projectName: proj.name
            });
        });
    });

    // Initialize Unassigned group
    groups['unassigned'] = {
      key: 'unassigned',
      displayName: 'Non Assegnati',
      profiles: [],
      tasks: [],
      stats: { total: 0, completed: 0, percentage: 0 }
    };

    // 2. Distribute Tasks
    sourceProjects.forEach(proj => {
        (Object.values(proj.branches) as Branch[]).forEach(branch => {
          if (branch.archived && !showArchived) return;

          branch.tasks.forEach(task => {
            // Apply showOnlyOpen filter
            if (showOnlyOpen && task.completed) return;

            let targetKey = 'unassigned';
            
            if (task.assigneeId) {
                // Try to find the group key for this specific project + assignee
                const lookup = idToKeyMap[`${proj.id}-${task.assigneeId}`];
                if (lookup && groups[lookup]) {
                    targetKey = lookup;
                }
            }
            
            groups[targetKey].tasks.push({
              id: task.id,
              title: task.title,
              description: task.description,
              completed: task.completed,
              completedAt: task.completedAt,
              dueDate: task.dueDate,
              branchId: branch.id,
              branchTitle: branch.title,
              projectId: proj.id,
              projectName: proj.name,
              pinned: task.pinned,
              originalAssigneeId: task.assigneeId || ''
            });
          });
        });
    });

    // 3. Stats & Sorting
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1;
      });
      
      group.stats.total = group.tasks.length;
      group.stats.completed = group.tasks.filter(t => t.completed).length;
      group.stats.percentage = group.stats.total > 0 
        ? Math.round((group.stats.completed / group.stats.total) * 100) 
        : 0;
    });

    const result = Object.values(groups).filter(g => g.key !== 'unassigned');
    // Sort groups alphabetically
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    if (groups['unassigned'].tasks.length > 0) {
        result.push(groups['unassigned']);
    }
    
    return result;
  }, [state, projects, showAllProjects, showArchived, showOnlyOpen]);

  // Logic to handle contact button click
  const handleContactClick = (group: AggregatedUserGroup) => {
      // Filter profiles that have some contact info
      const contactableProfiles = group.profiles.filter(p => p.email || p.phone);
      
      if (contactableProfiles.length === 0) {
          alert("Nessuna informazione di contatto disponibile per questo utente.");
          return;
      }

      // Check for unique contact endpoints to see if we have a conflict
      const uniqueContacts = new Set(contactableProfiles.map(p => `${p.email || ''}|${p.phone || ''}`));
      
      if (uniqueContacts.size === 1) {
          const currentProjectProfile = contactableProfiles.find(p => p.projectId === state.id);
          const targetId = currentProjectProfile ? currentProjectProfile.id : contactableProfiles[0].id;
          
          if (contactableProfiles.length > 1 && !currentProjectProfile) {
               setConflictGroup(group); 
          } else {
               setRemindingUserId(targetId);
          }
      } else {
          // Genuine conflict (different emails/phones)
          setConflictGroup(group);
      }
  };

  return (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24 relative">
      
      {/* Conflict Resolution Modal */}
      {conflictGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-slate-800 p-6">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Seleziona Contatto</h3>
                          <p className="text-sm text-slate-500">
                              L'utente <strong>{conflictGroup.displayName}</strong> è presente in più progetti. A quale indirizzo vuoi inviare il promemoria?
                          </p>
                      </div>
                      <button onClick={() => setConflictGroup(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                          <X className="w-5 h-5 text-slate-400" />
                      </button>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                      {conflictGroup.profiles.map((profile, idx) => (
                          <button
                              key={`${profile.projectId}-${profile.id}-${idx}`}
                              onClick={() => {
                                  if (profile.projectId !== state.id) {
                                      if(confirm(`Questo contatto appartiene al progetto "${profile.projectName}". Vuoi passare a quel progetto per inviare il messaggio?`)) {
                                          switchProject(profile.projectId);
                                          setTimeout(() => {
                                              setRemindingUserId(profile.id);
                                              setConflictGroup(null);
                                          }, 100);
                                      }
                                  } else {
                                      setRemindingUserId(profile.id);
                                      setConflictGroup(null);
                                  }
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group text-left"
                          >
                              <div className="flex items-center gap-3">
                                  <Avatar person={profile} size="md" />
                                  <div className="min-w-0">
                                      <div className="text-sm font-semibold text-slate-800 dark:text-white">{profile.projectName}</div>
                                      <div className="text-xs text-slate-500 flex flex-col">
                                          {profile.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {profile.email}</span>}
                                          {profile.phone && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3"/> {profile.phone}</span>}
                                          {!profile.email && !profile.phone && <span className="italic">Nessun contatto</span>}
                                      </div>
                                  </div>
                              </div>
                              {profile.projectId !== state.id && (
                                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                              )}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            Task per Utente
            {showAllProjects && <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full ml-2">Tutti i progetti (Aggregati)</span>}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
            Visualizza il carico di lavoro. Utenti con lo stesso nome in progetti diversi vengono unificati.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {taskGroups.map(group => {
            const isUnassigned = group.key === 'unassigned';
            const isEmpty = group.stats.total === 0;
            
            // Use the first available profile for visual representation
            const displayPerson = group.profiles[0];

            // Determine if this group represents multiple projects
            const uniqueProjects = new Set(group.profiles.map(p => p.projectId)).size;
            const isMultiProject = uniqueProjects > 1;

            return (
                <div key={group.key} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden ${isEmpty ? 'opacity-70' : ''}`}>
                    {/* Card Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {isUnassigned ? (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                        <HelpCircle className="w-5 h-5" />
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Avatar person={displayPerson} size="lg" className="shrink-0" />
                                        {isMultiProject && (
                                            <div className="absolute -bottom-1 -right-1 bg-amber-100 dark:bg-amber-900 border border-white dark:border-slate-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-400" title="Presente in più progetti">
                                                {uniqueProjects}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 dark:text-white truncate flex items-center gap-2">
                                        {group.displayName}
                                    </h3>
                                    {!isUnassigned && (
                                        <div className="flex flex-col">
                                            {group.profiles.length > 1 ? (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {group.profiles.length} profili collegati
                                                </p>
                                            ) : (
                                                displayPerson.email && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {displayPerson.email}
                                                    </p>
                                                )
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
                                        onClick={() => handleContactClick(group)}
                                        className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                                        title={isMultiProject ? "Scegli contatto" : "Invia Sollecito"}
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
                                {group.tasks.map(task => {
                                    const isForeign = task.projectId !== state.id;
                                    
                                    return (
                                        <li key={task.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <div className="flex items-start gap-3">
                                                <button 
                                                    onClick={() => {
                                                        if (isForeign) {
                                                            switchProject(task.projectId);
                                                        } else {
                                                            updateTask(task.branchId, task.id, { completed: !task.completed });
                                                        }
                                                    }}
                                                    className={`mt-0.5 flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-500 hover:text-indigo-500'}`}
                                                    title={isForeign ? "Vai al progetto per modificare" : "Completa"}
                                                >
                                                    {task.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                </button>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p 
                                                            className={`text-sm font-medium mb-0.5 cursor-pointer hover:underline ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                            onClick={() => {
                                                                if (isForeign) {
                                                                    switchProject(task.projectId);
                                                                    setTimeout(() => setEditingTask({ branchId: task.branchId, taskId: task.id }), 100);
                                                                } else {
                                                                    setEditingTask({ branchId: task.branchId, taskId: task.id });
                                                                }
                                                            }}
                                                            title="Modifica Task"
                                                        >
                                                            {task.title}
                                                        </p>
                                                        {task.description && task.description.trim() !== '' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isForeign) switchProject(task.projectId);
                                                                    setTimeout(() => setReadingTask({ branchId: task.branchId, taskId: task.id }), isForeign ? 100 : 0);
                                                                }}
                                                                className="text-slate-400 hover:text-indigo-500 p-0.5"
                                                                title="Leggi Descrizione"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {isForeign && (
                                                            <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-600 flex items-center gap-0.5" title={task.projectName}>
                                                                <Folder className="w-2.5 h-2.5" /> 
                                                                <span className="truncate max-w-[80px]">{task.projectName}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                                                        <span 
                                                            className="flex items-center gap-1 hover:text-indigo-500 cursor-pointer transition-colors max-w-[150px] truncate"
                                                            onClick={() => {
                                                                if(isForeign) switchProject(task.projectId);
                                                                setTimeout(() => selectBranch(task.branchId), isForeign ? 100 : 0);
                                                            }}
                                                            title="Vai al ramo"
                                                        >
                                                            <ArrowRight className="w-3 h-3" />
                                                            {task.branchTitle}
                                                        </span>
                                                        
                                                        <div className="flex flex-col gap-0.5">
                                                            {task.dueDate && (
                                                                <span className={`flex items-center gap-1 ${task.completed ? '' : 'text-amber-600 dark:text-amber-500 font-medium'}`}>
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(task.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit'})}
                                                                </span>
                                                            )}
                                                            {task.completed && task.completedAt && (
                                                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold" title={new Date(task.completedAt).toLocaleString()}>
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Chiuso: {new Date(task.completedAt).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit'})}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Pin Button */}
                                                {!isForeign && (
                                                    <button
                                                        onClick={() => updateTask(task.branchId, task.id, { pinned: !task.pinned })}
                                                        className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all ${task.pinned ? 'opacity-100 text-amber-500' : 'text-slate-300'}`}
                                                        title={task.pinned ? "Rimuovi da Focus" : "Aggiungi a Focus"}
                                                    >
                                                        <Pin className={`w-3.5 h-3.5 ${task.pinned ? 'fill-current' : ''}`} />
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
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
