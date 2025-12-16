import React, { useMemo, useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch, BranchStatus } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { GanttChart, ChevronRight, Calendar as CalendarIcon, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';

const CELL_WIDTH = 50; // Width of one day in pixels
const HEADER_HEIGHT = 60;
const SIDEBAR_WIDTH = 200;

const TimelinePanel: React.FC = () => {
  const { state, selectBranch, showArchived } = useProject();
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = Normal, 0.5 = Zoom Out

  // 1. Prepare Data
  const { branches, minDate, maxDate, totalDays } = useMemo(() => {
    const activeBranches = (Object.values(state.branches) as Branch[]).filter(b => {
        // Exclude Root
        if (b.id === state.rootBranchId) return false;
        // Filter Archived
        if (b.archived && !showArchived) return false;
        return true;
    });

    // Sort by start date, then title
    activeBranches.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateA - dateB || a.title.localeCompare(b.title);
    });

    // Calculate Global Bounds
    let min = new Date();
    let max = new Date();
    // Default range: Today - 7 days to Today + 30 days
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    activeBranches.forEach(b => {
        if (b.startDate) {
            const start = new Date(b.startDate);
            if (start < min) min = start;
        }
        // Check end date or due date
        const endStr = b.endDate || b.dueDate;
        if (endStr) {
            const end = new Date(endStr);
            if (end > max) max = end;
        }
    });

    // Add some padding
    min = new Date(min); // Clone
    min.setDate(min.getDate() - 3);
    max = new Date(max);
    max.setDate(max.getDate() + 7);

    // Normalize to midnight
    min.setHours(0,0,0,0);
    max.setHours(0,0,0,0);

    const diffTime = Math.abs(max.getTime() - min.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
        branches: activeBranches, 
        minDate: min, 
        maxDate: max, 
        totalDays: days 
    };
  }, [state.branches, state.rootBranchId, showArchived]);

  // Helper to get X position for a date
  const getXForDate = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      date.setHours(0,0,0,0);
      const diffTime = date.getTime() - minDate.getTime();
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return days * (CELL_WIDTH * zoomLevel);
  };

  // Helper to render date headers
  const renderTimeHeader = () => {
      const headers = [];
      const current = new Date(minDate);
      
      for (let i = 0; i <= totalDays; i++) {
          const isToday = new Date().toDateString() === current.toDateString();
          const isMonthStart = current.getDate() === 1;
          
          headers.push(
              <div 
                key={i} 
                className={`absolute bottom-0 border-r border-slate-200 dark:border-slate-700 h-full flex flex-col justify-end pb-1 text-[10px] items-center text-slate-500 dark:text-slate-400 select-none ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                style={{ left: i * (CELL_WIDTH * zoomLevel), width: (CELL_WIDTH * zoomLevel) }}
              >
                  <span className="font-bold">{current.getDate()}</span>
                  <span className="text-[9px] uppercase">{current.toLocaleDateString('it-IT', { weekday: 'narrow' })}</span>
                  
                  {/* Month Label overlay */}
                  {(isMonthStart || i === 0) && (
                      <div className="absolute top-0 left-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {current.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                      </div>
                  )}
              </div>
          );
          current.setDate(current.getDate() + 1);
      }
      return headers;
  };

  const getBarDimensions = (branch: Branch) => {
      let startX = getXForDate(branch.startDate);
      let endX = getXForDate(branch.endDate || branch.dueDate);
      
      // If no start date, but has end date, assume start is recent or fix visual length
      if (startX === null && endX !== null) {
          startX = endX - (3 * CELL_WIDTH * zoomLevel); // 3 days default
      }
      // If start date but no end, assume 1 day or until today
      if (startX !== null && endX === null) {
          endX = startX + (CELL_WIDTH * zoomLevel);
      }
      // If neither, place at "Today" (handled loosely, maybe don't show bar, just row)
      if (startX === null && endX === null) {
          const todayX = getXForDate(new Date().toISOString());
          if (todayX) {
              startX = todayX;
              endX = todayX + (CELL_WIDTH * zoomLevel);
          } else {
              return null; // Should not happen given min/max calculation
          }
      }

      return { x: startX!, width: Math.max((endX! - startX!), (CELL_WIDTH * zoomLevel)) };
  };

  const todayX = getXForDate(new Date().toISOString());

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
          <div className="flex items-center gap-2">
              <GanttChart className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Timeline di Progetto</h2>
          </div>
          <div className="flex items-center gap-2">
              <button 
                onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                disabled={zoomLevel <= 0.5}
              >
                  <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono w-12 text-center text-slate-500">{(zoomLevel * 100).toFixed(0)}%</span>
              <button 
                onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                disabled={zoomLevel >= 2}
              >
                  <ZoomIn className="w-4 h-4" />
              </button>
          </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
          
          {/* Sidebar (Branch List) */}
          <div 
            className="flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg"
            style={{ width: SIDEBAR_WIDTH, marginTop: HEADER_HEIGHT }}
          >
              <div className="overflow-y-hidden h-full"> {/* Synced via main scroll container logic usually, but here distinct for simplicity */}
                  {branches.map(branch => {
                      const statusConfig = STATUS_CONFIG[branch.status];
                      return (
                          <div 
                            key={branch.id} 
                            className="h-12 border-b border-slate-100 dark:border-slate-800 flex items-center px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            onClick={() => selectBranch(branch.id)}
                          >
                              <div className={`w-2 h-2 rounded-full ${statusConfig.color.replace('bg-', 'bg-opacity-100 bg-').split(' ')[1] || 'bg-slate-400'}`}></div>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate flex-1">{branch.title}</span>
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                          </div>
                      );
                  })}
                  {branches.length === 0 && (
                      <div className="p-4 text-xs text-slate-400 text-center italic">Nessun ramo attivo.</div>
                  )}
              </div>
          </div>

          {/* Chart Area */}
          <div className="flex-1 overflow-auto relative custom-scrollbar bg-slate-50 dark:bg-slate-950">
              <div 
                className="relative min-w-full"
                style={{ width: (totalDays + 1) * (CELL_WIDTH * zoomLevel), height: (branches.length * 48) + HEADER_HEIGHT }}
              >
                  {/* Time Header (Sticky Top) */}
                  <div 
                    className="sticky top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 shadow-sm"
                    style={{ height: HEADER_HEIGHT }}
                  >
                      {renderTimeHeader()}
                  </div>

                  {/* Grid Lines Background */}
                  <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex" style={{ paddingTop: HEADER_HEIGHT }}>
                      {Array.from({ length: totalDays + 1 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="border-r border-slate-200/50 dark:border-slate-800/50 h-full"
                            style={{ width: (CELL_WIDTH * zoomLevel) }}
                          />
                      ))}
                  </div>

                  {/* Today Line */}
                  {todayX !== null && (
                      <div 
                        className="absolute top-0 bottom-0 border-l-2 border-red-400/50 z-0 pointer-events-none"
                        style={{ left: todayX, marginTop: HEADER_HEIGHT }}
                      >
                          <div className="absolute -top-6 -left-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                  )}

                  {/* Bars Container */}
                  <div className="relative z-0">
                      {branches.map(branch => {
                          const dims = getBarDimensions(branch);
                          // Calculate Due Date X Position
                          const dueX = getXForDate(branch.dueDate);
                          const statusConfig = STATUS_CONFIG[branch.status];
                          
                          // Calculate Progress
                          const totalTasks = branch.tasks.length;
                          const completed = branch.tasks.filter(t => t.completed).length;
                          const pct = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;

                          // Dynamic Colors based on Status config (parsing tailwind classes roughly)
                          let barColor = 'bg-slate-400';
                          if (branch.status === BranchStatus.ACTIVE) barColor = 'bg-indigo-500';
                          else if (branch.status === BranchStatus.PLANNED) barColor = 'bg-slate-400';
                          else if (branch.status === BranchStatus.CLOSED) barColor = 'bg-blue-500';
                          else if (branch.status === BranchStatus.STANDBY) barColor = 'bg-amber-500';
                          else if (branch.status === BranchStatus.CANCELLED) barColor = 'bg-red-500';

                          return (
                              <div key={branch.id} className="h-12 border-b border-transparent relative group">
                                  {dims ? (
                                      <div 
                                        className={`absolute top-2 h-8 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110 flex items-center overflow-hidden ${barColor} bg-opacity-80 dark:bg-opacity-60 border border-white/20`}
                                        style={{ left: dims.x, width: dims.width }}
                                        onClick={() => selectBranch(branch.id)}
                                        title={`${branch.title} (${branch.startDate || '?'} - ${branch.endDate || branch.dueDate || '?'})`}
                                      >
                                          {/* Progress Fill */}
                                          <div 
                                            className="h-full bg-black/20 absolute left-0 top-0 transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                          />
                                          
                                          {/* Label inside bar if wide enough */}
                                          {dims.width > 60 && (
                                              <span className="relative z-10 px-2 text-xs font-bold text-white truncate drop-shadow-md">
                                                  {branch.title}
                                              </span>
                                          )}
                                      </div>
                                  ) : (
                                      <div className="absolute top-2 left-2 text-xs text-slate-400 italic">Data mancante</div>
                                  )}

                                  {/* Deadline Marker */}
                                  {dueX !== null && (
                                    <div 
                                        className="absolute top-4 w-2.5 h-2.5 bg-red-500 rotate-45 border border-white dark:border-slate-900 shadow-sm z-20 hover:scale-125 transition-transform group/marker cursor-help"
                                        style={{ left: dueX + (CELL_WIDTH * zoomLevel) - 5 }} // Position at end of day cell
                                    >
                                        <div className="hidden group-hover/marker:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap z-50 shadow-lg pointer-events-none">
                                            Scadenza: {new Date(branch.dueDate!).toLocaleDateString('it-IT')}
                                        </div>
                                    </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default TimelinePanel;