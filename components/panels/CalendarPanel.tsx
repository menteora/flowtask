
import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BranchStatus, Branch, Task } from '../../types';
import { Calendar, Clock, AlertCircle, CheckCircle2, FileText, PlayCircle, StopCircle, ArrowRight, Folder, TrendingUp, Globe } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface TimelineItem {
  id: string;
  type: 'task' | 'branch_start' | 'branch_due' | 'branch_end';
  dateStr: string; // YYYY-MM-DD
  dateObj: Date;
  title: string;
  subtitle?: string;
  branchId: string;
  branchTitle: string;
  assigneeId?: string;
  isCompleted?: boolean;
  status?: BranchStatus;
  projectId: string;
  projectName: string;
}

const CalendarPanel: React.FC = () => {
  const { state, projects, showAllProjects, selectBranch, setEditingTask, switchProject } = useProject();

  // Utility to get local YYYY-MM-DD string
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. Calculate Completion Statistics
  const stats = useMemo(() => {
    const dailyCount: Record<string, number> = {};
    const projectContribution: Record<string, { name: string, count: number }> = {};
    const today = new Date();
    const todayStr = getLocalDateString(today);
    
    // Analyzes projects based on Global Globe toggle in header
    const sourceForStats = showAllProjects ? projects : [state];
    
    sourceForStats.forEach(project => {
        let projTodayCount = 0;
        Object.values(project.branches).forEach((branch: any) => {
            branch.tasks.forEach((task: Task) => {
                // FALLBACK: If completed but missing completedAt, we treat it as an older event to populate charts
                if (task.completed) {
                    const completedDate = task.completedAt ? new Date(task.completedAt) : null;
                    if (completedDate) {
                        const dateKey = getLocalDateString(completedDate);
                        dailyCount[dateKey] = (dailyCount[dateKey] || 0) + 1;
                        if (dateKey === todayStr) {
                            projTodayCount++;
                        }
                    }
                }
            });
        });
        projectContribution[project.id] = { name: project.name, count: projTodayCount };
    });

    // Get last 7 days labels and data
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = getLocalDateString(d);
        return {
            label: d.toLocaleDateString('it-IT', { weekday: 'short' }),
            date: key,
            count: dailyCount[key] || 0
        };
    });

    const totalIn7Days = last7Days.reduce((acc, curr) => acc + curr.count, 0);
    const average = (totalIn7Days / 7).toFixed(1);
    const completedToday = dailyCount[todayStr] || 0;

    return { last7Days, average, completedToday, totalIn7Days, projectContribution };
  }, [state, projects, showAllProjects]);

  // 2. Prepare Calendar Items
  const items = useMemo(() => {
    const list: TimelineItem[] = [];
    const sourceProjects = showAllProjects ? projects : [state];

    sourceProjects.forEach(project => {
        (Object.values(project.branches) as Branch[]).forEach(branch => {
            if (branch.archived || branch.status === BranchStatus.CANCELLED) return;

            const commonProps = {
                branchId: branch.id,
                branchTitle: branch.title,
                status: branch.status,
                projectId: project.id,
                projectName: project.name
            };

            if (branch.dueDate) {
                list.push({
                    id: `${branch.id}-due`,
                    type: 'branch_due',
                    dateStr: branch.dueDate,
                    dateObj: new Date(branch.dueDate),
                    title: 'Scadenza Ramo',
                    ...commonProps
                });
            }
            if (branch.endDate && branch.status !== BranchStatus.CLOSED) {
                list.push({
                    id: `${branch.id}-end`,
                    type: 'branch_end',
                    dateStr: branch.endDate,
                    dateObj: new Date(branch.endDate),
                    title: 'Chiusura Prevista',
                    ...commonProps
                });
            }

            branch.tasks.forEach(task => {
                if (task.dueDate && !task.completed) {
                    list.push({
                        id: task.id,
                        type: 'task',
                        dateStr: task.dueDate,
                        dateObj: new Date(task.dueDate),
                        title: task.title,
                        assigneeId: task.assigneeId,
                        isCompleted: task.completed,
                        ...commonProps
                    });
                }
            });
        });
    });

    return list.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [state, projects, showAllProjects]);

  // Grouping items for UI sections
  const grouped = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      return {
          overdue: items.filter(i => i.dateObj < today),
          today: items.filter(i => i.dateObj.getTime() === today.getTime()),
          week: items.filter(i => i.dateObj > today && i.dateObj <= nextWeek),
          future: items.filter(i => i.dateObj > nextWeek),
      };
  }, [items]);

  const RenderItem: React.FC<{ item: TimelineItem }> = ({ item }) => {
      let icon = <AlertCircle className="w-5 h-5 text-gray-400" />;
      let colorClass = "bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700";
      
      switch(item.type) {
          case 'task':
              icon = <FileText className="w-5 h-5 text-indigo-500" />;
              colorClass = "bg-white border-gray-200 dark:bg-slate-800 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700";
              break;
          case 'branch_due':
              icon = <Clock className="w-5 h-5 text-amber-500" />;
              colorClass = "bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30";
              break;
          case 'branch_end':
              icon = <StopCircle className="w-5 h-5 text-blue-500" />;
              colorClass = "bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30";
              break;
      }

      let assignee = null;
      if (item.assigneeId) {
          const project = projects.find(p => p.id === item.projectId);
          if (project) assignee = project.people.find(p => p.id === item.assigneeId);
      }

      const handleClick = () => {
          if (item.projectId !== state.id) {
              switchProject(item.projectId);
              setTimeout(() => {
                   if (item.type === 'task') {
                       setEditingTask({ branchId: item.branchId, taskId: item.id });
                   } else {
                       selectBranch(item.branchId);
                   }
              }, 100);
          } else {
              if (item.type === 'task') {
                  setEditingTask({ branchId: item.branchId, taskId: item.id });
              } else {
                  selectBranch(item.branchId);
              }
          }
      };

      return (
          <div 
            onClick={handleClick}
            className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm transition-all cursor-pointer ${colorClass}`}
          >
              <div className="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1 bg-white dark:bg-slate-950 rounded border border-gray-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-500 uppercase">{item.dateObj.toLocaleDateString('it-IT', { month: 'short' })}</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{item.dateObj.getDate()}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                      {icon}
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</span>
                      {showAllProjects && (
                          <span className="ml-auto text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <Folder className="w-3 h-3" /> {item.projectName}
                          </span>
                      )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{item.branchTitle}</span>
                      {item.type !== 'task' && <span className="opacity-60">• {item.status}</span>}
                  </div>
              </div>

              {assignee && <Avatar person={assignee} size="sm" />}
              {item.type !== 'task' && !assignee && <ArrowRight className="w-4 h-4 text-slate-300" />}
          </div>
      )
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Calendar className="w-8 h-8 text-indigo-600" />
                    Scadenze & Performance
                    {showAllProjects && <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full ml-2 flex items-center gap-1"><Globe className="w-3 h-3"/> Vista Globale</span>}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Timeline delle scadenze e analisi completamenti.</p>
            </div>
            
            {/* Stats Summary Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col gap-3 min-w-[320px] relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            {showAllProjects ? 'Modalità Globale' : 'Progetto Corrente'}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-500" /> Media 7gg
                        </span>
                        <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{stats.average}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Oggi</span>
                        <div className="flex items-baseline gap-2">
                             <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.completedToday}</span>
                             {showAllProjects && (
                                 <div className="flex flex-wrap gap-x-2 text-[9px] text-slate-500 font-medium">
                                     {(Object.values(stats.projectContribution) as any[]).filter(p => p.count > 0).map((p, idx) => (
                                         <span key={idx}>{p.name}: {p.count}</span>
                                     ))}
                                 </div>
                             )}
                        </div>
                    </div>
                    
                    {/* Mini chart visualizer */}
                    <div className="flex items-end gap-1.5 h-12 ml-auto">
                        {stats.last7Days.map((d, i) => {
                            const maxVal = Math.max(...stats.last7Days.map(x => x.count)) || 1;
                            const height = (d.count / maxVal) * 40;
                            return (
                                <div key={i} className="flex flex-col items-center gap-1 group/bar relative">
                                    <div 
                                        className={`w-2 rounded-t-md transition-all duration-500 ${i === 6 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'} group-hover/bar:bg-indigo-400`} 
                                        style={{ height: `${Math.max(height, 2)}px` }}
                                    />
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">{d.label[0]}</span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bar:block bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded z-50 whitespace-nowrap">
                                        {d.count} task
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-8">
            {grouped.overdue.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Scaduti
                    </h3>
                    <div className="grid gap-2">
                        {grouped.overdue.map(item => <RenderItem key={item.id} item={item} />)}
                    </div>
                </section>
            )}

            {grouped.today.length > 0 && (
                <section>
                    <h3 className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Oggi
                    </h3>
                    <div className="grid gap-2">
                        {grouped.today.map(item => <RenderItem key={item.id} item={item} />)}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Questa Settimana</h3>
                <div className="grid gap-2">
                    {grouped.week.length === 0 && <p className="text-sm text-slate-400 italic">Nessuna scadenza prevista.</p>}
                    {grouped.week.map(item => <RenderItem key={item.id} item={item} />)}
                </div>
            </section>

            <section>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Prossimamente</h3>
                <div className="grid gap-2">
                    {grouped.future.length === 0 && <p className="text-sm text-slate-400 italic">Niente in programma.</p>}
                    {grouped.future.map(item => <RenderItem key={item.id} item={item} />)}
                </div>
            </section>
        </div>
    </div>
  );
};

export default CalendarPanel;
