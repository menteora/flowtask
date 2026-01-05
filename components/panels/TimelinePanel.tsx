
import React, { useMemo, useState, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { Branch, BranchStatus, Task } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { GanttChart, ChevronRight, ZoomIn, ZoomOut, Folder } from 'lucide-react';

const CELL_WIDTH = 50; 
const HEADER_HEIGHT = 80; 
const SIDEBAR_WIDTH = 220;

const TimelinePanel: React.FC = () => {
  const { state, projects, switchProject } = useProject();
  // Using BranchContext for specific branch-related actions and state
  const { selectBranch, showArchived, showAllProjects } = useBranch();

  const [zoomLevel, setZoomLevel] = useState(1); 

  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const sourceProjects = showAllProjects ? projects : [state];

  // 1. Calculate Daily Completions for Timeline (using Local Time)
  const dailyCompletions = useMemo(() => {
      const counts: Record<string, number> = {};
      sourceProjects.forEach(proj => {
          (Object.values(proj.branches) as Branch[]).forEach(b => {
              b.tasks.forEach(t => {
                  // STRICT CHECK: ignore tasks without an explicit completion timestamp
                  if (t.completed && t.completedAt) {
                      const completedDate = new Date(t.completedAt);
                      const dateKey = getLocalDateString(completedDate);
                      counts[dateKey] = (counts[dateKey] || 0) + 1;
                  }
              });
          });
      });
      return counts;
  }, [sourceProjects]);

  // 2. Prepare Branch Data
  const { branches, minDate, maxDate, totalDays } = useMemo(() => {
    let allActiveBranches: (Branch & { projectName: string, projectId: string })[] = [];

    sourceProjects.forEach(proj => {
        const projBranches = (Object.values(proj.branches) as Branch[]).filter(b => {
            if (b.id === proj.rootBranchId) return false;
            if (b.archived && !showArchived) return false;
            return true;
        });
        
        const enhancedBranches = projBranches.map(b => ({
            ...b,
            projectName: proj.name,
            projectId: proj.id
        }));

        allActiveBranches = [...allActiveBranches, ...enhancedBranches];
    });

    allActiveBranches.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateA - dateB || a.title.localeCompare(b.title);
    });

    let min = new Date();
    let max = new Date();
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    allActiveBranches.forEach(b => {
        if (b.startDate) {
            const start = new Date(b.startDate);
            if (start < min) min = start;
        }
        const endStr = b.endDate || b.dueDate;
        if (endStr) {
            const end = new Date(endStr);
            if (end > max) max = end;
        }
    });

    min = new Date(min);
    min.setDate(min.getDate() - 3);
    max = new Date(max);
    max.setDate(max.getDate() + 7);

    min.setHours(0,0,0,0);
    max.setHours(0,0,0,0);

    const diffTime = Math.abs(max.getTime() - min.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
        branches: allActiveBranches, 
        minDate: min, 
        maxDate: max, 
        totalDays: days 
    };
  }, [sourceProjects, showArchived]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (sidebarRef.current) {
          sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
      }
  };

  const getXForDate = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      date.setHours(0,0,0,0);
      const diffTime = date.getTime() - minDate.getTime();
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return days * (CELL_WIDTH * zoomLevel);
  };

  const renderTimeHeader = () => {
      const headers = [];
      const current = new Date(minDate);
      
      for (let i = 0; i <= totalDays; i++) {
          const dateKey = getLocalDateString(current);
          const completions = dailyCompletions[dateKey] || 0;
          const isToday = new Date().toDateString() === current.toDateString();
          const isMonthStart = current.getDate() === 1;
          
          headers.push(
              <div 
                key={i} 
                className={`absolute bottom-0 border-r border-slate-200 dark:border-slate-700 h-full flex flex-col justify-end items-center text-slate-500 dark:text-slate-400 select-none pb-2 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                style={{ left: i * (CELL_WIDTH * zoomLevel), width: (CELL_WIDTH * zoomLevel) }}
              >
                  <div className="absolute bottom-[44px] flex flex-col items-center group/stat">
                      {completions > 0 && (
                          <div 
                            className="bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm transform hover:scale-125 transition-transform"
                            title={`${completions} task completati`}
                          >
                              {completions}
                          </div>
                      )}
                  </div>

                  <span className="text-[10px] font-bold mt-auto leading-none">{current.getDate()}</span>
                  <span className="text-[8px] uppercase font-medium leading-tight opacity-70">{current.toLocaleDateString('it-IT', { weekday: 'narrow' })}</span>
                  
                  {(isMonthStart || i === 0) && (
                      <div className="absolute top-2 left-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap bg-white/80 dark:bg-slate-900/80 px-1 rounded">
                          {current.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }).toUpperCase()}
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
      if (startX === null && endX !== null) startX = endX - (3 * CELL_WIDTH * zoomLevel);
      if (startX !== null && endX === null) endX = startX + (CELL_WIDTH * zoomLevel);
      if (startX === null && endX === null) {
          const tX = getXForDate(new Date().toISOString());
          if (tX) { startX = tX; endX = tX + (CELL_WIDTH * zoomLevel); }
          else return null;
      }
      return { x: startX!, width: Math.max((endX! - startX!), (CELL_WIDTH * zoomLevel)) };
  };

  const todayX = getXForDate(new Date().toISOString());

  const handleBranchClick = (branch: Branch & { projectId: string }) => {
      if (branch.projectId !== state.id) {
          switchProject(branch.projectId);
          setTimeout(() => selectBranch(branch.id), 100);
      } else {
          selectBranch(branch.id);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 flex-shrink-0">
          <div className="flex items-center gap-2">
              <GanttChart className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  Timeline & Velocity
              </h2>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                  Task Chiusi
              </div>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2">
                  <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" disabled={zoomLevel <= 0.5}>
                      <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono w-10 text-center text-slate-500">{(zoomLevel * 100).toFixed(0)}%</span>
                  <button onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" disabled={zoomLevel >= 2}>
                      <ZoomIn className="w-4 h-4" />
                  </button>
              </div>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
          <div 
            ref={sidebarRef}
            className="flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg overflow-hidden"
            style={{ width: SIDEBAR_WIDTH, marginTop: HEADER_HEIGHT }}
          >
              <div className="flex flex-col"> 
                  {branches.map(branch => {
                      const statusConfig = STATUS_CONFIG[branch.status];
                      return (
                          <div 
                            key={`${branch.projectId}-${branch.id}`} 
                            className="h-12 border-b border-slate-100 dark:border-slate-800 flex items-center px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex-shrink-0"
                            onClick={() => handleBranchClick(branch)}
                          >
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.color.replace('bg-', 'bg-opacity-100 bg-').split(' ')[1] || 'bg-slate-400'}`}></div>
                              <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{branch.title}</span>
                                  {showAllProjects && <span className="text-[9px] text-slate-400 truncate flex items-center gap-1"><Folder className="w-2.5 h-2.5" /> {branch.projectName}</span>}
                              </div>
                              <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          </div>
                      );
                  })}
              </div>
          </div>

          <div 
            ref={timelineRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto relative custom-scrollbar bg-slate-50 dark:bg-slate-950"
          >
              <div 
                className="relative min-w-full"
                style={{ width: (totalDays + 1) * (CELL_WIDTH * zoomLevel), height: (branches.length * 48) + HEADER_HEIGHT }}
              >
                  <div 
                    className="sticky top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm"
                    style={{ height: HEADER_HEIGHT }}
                  >
                      {renderTimeHeader()}
                  </div>

                  <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none flex" style={{ paddingTop: HEADER_HEIGHT }}>
                      {Array.from({ length: totalDays + 1 }).map((_, i) => (
                          <div key={i} className="border-r border-slate-200/30 dark:border-slate-800/30 h-full" style={{ width: (CELL_WIDTH * zoomLevel) }} />
                      ))}
                  </div>

                  {todayX !== null && (
                      <div className="absolute top-0 bottom-0 border-l-2 border-red-500/30 z-10 pointer-events-none" style={{ left: todayX, marginTop: HEADER_HEIGHT }}>
                          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                      </div>
                  )}

                  <div className="relative z-20">
                      {branches.map(branch => {
                          const dims = getBarDimensions(branch);
                          const dueX = getXForDate(branch.dueDate);
                          const totalTasks = branch.tasks.length;
                          const completed = branch.tasks.filter(t => t.completed).length;
                          const pct = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;

                          let barColor = 'bg-slate-400';
                          if (branch.status === BranchStatus.ACTIVE) barColor = 'bg-indigo-500';
                          else if (branch.status === BranchStatus.CLOSED) barColor = 'bg-blue-500';
                          else if (branch.status === BranchStatus.STANDBY) barColor = 'bg-amber-500';
                          else if (branch.status === BranchStatus.CANCELLED) barColor = 'bg-red-500';

                          return (
                              <div key={`${branch.projectId}-${branch.id}`} className="h-12 border-b border-transparent relative group">
                                  {dims ? (
                                      <div 
                                        className={`absolute top-2 h-8 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110 flex items-center overflow-hidden ${barColor} bg-opacity-80 dark:bg-opacity-60 border border-white/20`}
                                        style={{ left: dims.x, width: dims.width }}
                                        onClick={() => handleBranchClick(branch)}
                                      >
                                          <div className="h-full bg-black/20 absolute left-0 top-0 transition-all duration-500" style={{ width: `${pct}%` }} />
                                          {dims.width > 60 && <span className="relative z-10 px-2 text-xs font-bold text-white truncate drop-shadow-md">{branch.title}</span>}
                                      </div>
                                  ) : null}

                                  {dueX !== null && (
                                    <div 
                                        className="absolute top-4 w-2.5 h-2.5 bg-red-500 rotate-45 border border-white dark:border-slate-900 shadow-sm z-30 hover:scale-125 transition-transform group/marker cursor-help"
                                        style={{ left: dueX + (CELL_WIDTH * zoomLevel) - 5 }}
                                    >
                                        <div className="hidden group-hover/marker:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-50 shadow-lg pointer-events-none">
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
