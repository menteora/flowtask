import React, { useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BranchStatus } from '../../types';
import { Calendar, Clock, AlertCircle, CheckCircle2, FileText, PlayCircle, StopCircle, ArrowRight } from 'lucide-react';
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
}

const CalendarPanel: React.FC = () => {
  const { state, selectBranch } = useProject();

  const items = useMemo(() => {
    const list: TimelineItem[] = [];
    const now = new Date();
    now.setHours(0,0,0,0);

    Object.values(state.branches).forEach(branch => {
        // Skip archived if needed, but usually deadlines are important regardless. 
        // Let's skip archived/closed for clarity unless specifically requested.
        if (branch.archived || branch.status === BranchStatus.CANCELLED) return;

        // Branch Dates
        if (branch.startDate) {
            list.push({
                id: `${branch.id}-start`,
                type: 'branch_start',
                dateStr: branch.startDate,
                dateObj: new Date(branch.startDate),
                title: 'Inizio Ramo',
                branchId: branch.id,
                branchTitle: branch.title,
                status: branch.status
            });
        }
        if (branch.dueDate) {
             list.push({
                id: `${branch.id}-due`,
                type: 'branch_due',
                dateStr: branch.dueDate,
                dateObj: new Date(branch.dueDate),
                title: 'Scadenza Ramo',
                branchId: branch.id,
                branchTitle: branch.title,
                status: branch.status
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
                branchId: branch.id,
                branchTitle: branch.title,
                status: branch.status
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
                    branchId: branch.id,
                    branchTitle: branch.title,
                    assigneeId: task.assigneeId,
                    isCompleted: task.completed
                });
            }
        });
    });

    return list.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [state.branches]);

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

  const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', weekday: 'short' });
  };

  const RenderItem = ({ item }: { item: TimelineItem }) => {
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

      const assignee = item.assigneeId ? state.people.find(p => p.id === item.assigneeId) : null;

      return (
          <div 
            onClick={() => selectBranch(item.branchId)}
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