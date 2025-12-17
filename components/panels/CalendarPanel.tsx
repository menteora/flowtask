import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BranchStatus, Branch } from '../../types';
import { Calendar, Clock, AlertCircle, CheckCircle2, FileText, PlayCircle, StopCircle, ArrowRight, Folder } from 'lucide-react';
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

  const items = useMemo(() => {
    const list: TimelineItem[] = [];
    const now = new Date();
    now.setHours(0,0,0,0);

    const sourceProjects = showAllProjects ? projects : [state];

    sourceProjects.forEach(project => {
        (Object.values(project.branches) as Branch[]).forEach(branch => {
            // Skip archived if needed, but usually deadlines are important regardless. 
            // Let's skip archived/closed for clarity unless specifically requested.
            if (branch.archived || branch.status === BranchStatus.CANCELLED) return;

            const commonProps = {
                branchId: branch.id,
                branchTitle: branch.title,
                status: branch.status,
                projectId: project.id,
                projectName: project.name
            };

            // Branch Dates
            if (branch.startDate) {
                list.push({
                    id: `${branch.id}-start`,
                    type: 'branch_start',
                    dateStr: branch.startDate,
                    dateObj: new Date(branch.startDate),
                    title: 'Inizio Ramo',
                    ...commonProps
                });
            }
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
            // End date (only if closed, but we filtered closed above? Let's keep Active deadlines mostly)
            // If a branch is Active but has an endDate set manually (projection), show it.
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

            // Task Dates
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

  // Grouping
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
          case 'branch_start':
              icon = <PlayCircle className="w-5 h-5 text-green-500" />;
              colorClass = "bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30";
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

      // Find person across all projects if viewing all
      let assignee = null;
      if (item.assigneeId) {
          const project = projects.find(p => p.id === item.projectId);
          if (project) assignee = project.people.find(p => p.id === item.assigneeId);
      }

      const handleClick = () => {
          // If viewing all projects and clicking item from another project
          if (showAllProjects && item.projectId !== state.id) {
              switchProject(item.projectId);
              // Small delay to allow state update before selecting item
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
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar className="w-8 h-8 text-indigo-600" />
                Scadenze & Timeline
                {showAllProjects && <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full ml-2">Tutti i progetti</span>}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Una panoramica cronologica di task e rami.</p>
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