
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './context/ThemeContext';
import { useProject } from './context/ProjectContext';
import { useBranch } from './context/BranchContext';
import { useTask } from './context/TaskContext';
import { Moon, Sun, GitBranch, Layers, Users, Download, Upload, Archive, Camera, Plus, X, Edit2, Calendar, ClipboardList, Settings, Cloud, Loader2, Check, AlertCircle, ChevronDown, Folder, GanttChart, Globe, Target, ChevronsDown, ChevronsUp, CheckCircle2, Trash2 } from 'lucide-react';
import FlowCanvas from './components/flow/FlowCanvas';
import FolderTree from './components/flow/FolderTree';
import BranchDetails from './components/panels/BranchDetails';
import PeopleManager from './components/panels/PeopleManager';
import CalendarPanel from './components/panels/CalendarPanel';
import UserTasksPanel from './components/panels/UserTasksPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import TimelinePanel from './components/panels/TimelinePanel';
import FocusPanel from './components/panels/FocusPanel';
import LoginScreen from './components/auth/LoginScreen';
import DescriptionReader from './components/modals/DescriptionReader';
import TaskDescriptionReader from './components/modals/TaskDescriptionReader';
import TaskEditorModal from './components/modals/TaskEditorModal';
import MessageComposer from './components/modals/MessageComposer';
import { toPng } from 'html-to-image';
import { localStorageService } from './services/localStorage';

type View = 'workflow' | 'team' | 'calendar' | 'assignments' | 'settings' | 'timeline' | 'focus';

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { 
    state, projects, activeProjectId, switchProject, createProject, closeProject, deleteProject, renameProject,
    session, loadingAuth, isInitializing, isOfflineMode, autoSaveStatus, notification, loadProject
  } = useProject();
  
  const { selectedBranchId, showArchived, toggleShowArchived, showAllProjects, toggleShowAllProjects, setAllBranchesCollapsed } = useBranch();
  const { showOnlyOpen, toggleShowOnlyOpen } = useTask();

  const [currentView, setCurrentView] = useState<View>(() => {
      const saved = localStorageService.getView('workflow');
      const validViews: View[] = ['workflow', 'team', 'calendar', 'assignments', 'settings', 'timeline', 'focus'];
      return (validViews.includes(saved as View) ? saved as View : 'workflow');
  });

  useEffect(() => {
      localStorageService.saveView(currentView);
  }, [currentView]);

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempProjectName, setTempProjectName] = useState('');

  if (isInitializing || (!isOfflineMode && loadingAuth)) {
      return (
          <div className="flex h-[100dvh] w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {isInitializing ? 'Caricamento risorse...' : 'Verifica accesso...'}
                  </p>
              </div>
          </div>
      );
  }

  if (!isOfflineMode && !session) return <LoginScreen />;

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `flowtask_${state.name.replace(/\s+/g, '_')}_${timestamp}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImageExport = async () => {
    const isMobile = window.innerWidth < 768;
    const type = isMobile ? 'tree' : 'canvas';
    const elementId = isMobile ? 'export-tree-content' : 'export-canvas-content';
    const node = document.getElementById(elementId);
    if (!node) { alert("Passa alla vista 'Workflow' per esportare l'immagine."); return; }

    try {
        const bgColor = theme === 'dark' ? '#020617' : '#f8fafc'; 
        const style: React.CSSProperties = { backgroundColor: bgColor, display: 'block', overflow: 'visible' };
        if (type === 'canvas') { style.width = `${node.scrollWidth}px`; style.height = `${node.scrollHeight}px`; }
        const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: bgColor, style: style as any });
        const link = document.createElement('a');
        link.download = `flowtask_${state.name.replace(/\s+/g, '_')}_${type}.png`;
        link.href = dataUrl; link.click();
    } catch (err) { console.error(err); }
  };

  const startEditingProject = (proj: any) => { setEditingNameId(proj.id); setTempProjectName(proj.name); };
  const saveProjectRename = () => { if (editingNameId && tempProjectName.trim()) { renameProject(tempProjectName.trim()); setEditingNameId(null); } };

  const NavItem = ({ view, icon: Icon, label }: { view: View; icon: any; label: string }) => (
    <button onClick={() => setCurrentView(view)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === view ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
      <Icon className="w-4 h-4" /> <span className="hidden lg:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans relative">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-top-4 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {notification.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="font-medium text-sm flex-1 break-words">{notification.message}</span>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={(e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const reader = new FileReader(); reader.onload = (ev) => { try { loadProject(JSON.parse(ev.target?.result as string)); } catch (err) {} };
          reader.readAsText(file); e.target.value = '';
      }} accept=".json" className="hidden" />
      
      <DescriptionReader /> <TaskDescriptionReader /> <TaskEditorModal /> <MessageComposer />

      {isProjectMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center" onClick={() => setIsProjectMenuOpen(false)}>
            <div className="bg-white dark:bg-slate-900 w-full sm:w-96 max-h-[80vh] sm:rounded-xl rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-lg">Tutti i Progetti</h3>
                    <button onClick={() => { createProject(); setIsProjectMenuOpen(false); }} className="p-2 bg-indigo-600 text-white rounded-full transition-transform active:scale-95"><Plus className="w-5 h-5" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {projects.map(proj => (
                        <div key={proj.id} className={`flex items-center justify-between p-3 rounded-xl ${proj.id === activeProjectId ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            <div className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => { switchProject(proj.id); setIsProjectMenuOpen(false); }}>
                                <Folder className="w-4 h-4 shrink-0" />
                                <div className="truncate"><p className="text-sm font-semibold truncate">{proj.name}</p></div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); startEditingProject(proj); }} className="p-2 text-slate-400 hover:text-indigo-500"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); closeProject(proj.id); }} className="p-2 text-slate-400 hover:text-amber-500"><X className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); deleteProject(proj.id); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-b-2xl"><button onClick={() => setIsProjectMenuOpen(false)} className="w-full py-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium">Chiudi Menu</button></div>
            </div>
        </div>
      )}

      {/* Header Principale */}
      <div className="flex w-full h-14 bg-white dark:bg-slate-900 border-b dark:border-slate-800 items-center justify-between px-4 z-40 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shrink-0"><GitBranch className="w-5 h-5 text-white" /></div>
          
          {/* Progetto Attivo (Mobile & Info) */}
          <div className="flex flex-col leading-tight min-w-0 max-w-[150px] md:max-w-none">
             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">FlowTask</span>
             <span className="font-bold text-sm truncate">{state.name}</span>
          </div>

          {session && !isOfflineMode && (
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] transition-colors ml-2 shrink-0">
                  {autoSaveStatus === 'saving' && <><Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" /> <span className="text-indigo-500 font-bold">SAVING</span></>}
                  {autoSaveStatus === 'saved' && <><Cloud className="w-2.5 h-2.5 text-green-500" /> <span className="text-green-500 font-bold">SYNCED</span></>}
              </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-0.5 mx-4">
           <NavItem view="workflow" icon={Layers} label="Workflow" />
           <NavItem view="focus" icon={Target} label="Focus" />
           <NavItem view="assignments" icon={ClipboardList} label="Task" />
           <NavItem view="calendar" icon={Calendar} label="Scadenze" />
           <NavItem view="timeline" icon={GanttChart} label="Timeline" />
           <NavItem view="team" icon={Users} label="Team" />
        </div>

        <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggleShowOnlyOpen} className={`p-2 rounded-full border transition-all ${showOnlyOpen ? 'bg-indigo-100 text-indigo-600 border-indigo-200 shadow-inner' : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Solo Task Aperti"><CheckCircle2 className="w-4 h-4" /></button>
            <button onClick={toggleShowAllProjects} className={`p-2 rounded-full border transition-all ${showAllProjects ? 'bg-amber-100 text-amber-600 border-amber-200 shadow-inner' : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Tutti i Progetti"><Globe className="w-4 h-4" /></button>
            <button onClick={toggleShowArchived} className={`p-2 rounded-full border transition-all ${showArchived ? 'bg-indigo-100 text-indigo-600 border-indigo-200 shadow-inner' : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Mostra Archiviati"><Archive className="w-4 h-4" /></button>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
            
            <button onClick={() => setCurrentView('settings')} className={`p-2 rounded-full border transition-all ${currentView === 'settings' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 shadow-inner' : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Impostazioni"><Settings className="w-4 h-4" /></button>
            <button onClick={toggleTheme} className="p-2 text-slate-500 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">{theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</button>
        </div>
      </div>

      {/* Barra dei Tab Progetti (Desktop Style IDE) */}
      <div className="hidden md:flex h-10 w-full bg-slate-100 dark:bg-slate-900/50 border-b dark:border-slate-800 items-center px-4 gap-1 z-30 flex-shrink-0 overflow-x-auto no-scrollbar">
         {projects.map(proj => (
              <div 
                key={proj.id}
                onClick={() => switchProject(proj.id)}
                className={`
                  group flex items-center gap-2 px-4 h-8 rounded-t-lg transition-all cursor-pointer relative min-w-[100px] max-w-[200px] text-xs font-bold border-t border-x
                  ${proj.id === activeProjectId 
                    ? 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 z-10' 
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800'}
                `}
              >
                <Folder className={`w-3 h-3 shrink-0 ${proj.id === activeProjectId ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className="truncate flex-1">{proj.name}</span>
                {projects.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); closeProject(proj.id); }}
                    className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity ${proj.id === activeProjectId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
                {proj.id === activeProjectId && (
                  <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-white dark:bg-slate-950 z-20"></div>
                )}
              </div>
            ))}
            <button 
              onClick={() => setIsProjectMenuOpen(true)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors ml-2"
              title="Apri o crea progetto"
            >
              <Plus className="w-4 h-4" />
            </button>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {currentView === 'workflow' ? (
            <>
                <div className="hidden md:block w-full h-full relative"><FlowCanvas /></div>
                <div className="block md:hidden w-full h-full"><FolderTree /></div>
                <div className="hidden md:flex absolute bottom-10 right-10 flex-col gap-2 z-30 pointer-events-none">
                    <div className="flex flex-col gap-2 pointer-events-auto bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-xl border dark:border-slate-800">
                        <button onClick={() => setAllBranchesCollapsed(false)} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors" title="Espandi"><ChevronsDown className="w-5 h-5" /></button>
                        <button onClick={() => setAllBranchesCollapsed(true)} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors" title="Comprimi"><ChevronsUp className="w-5 h-5" /></button>
                    </div>
                </div>
                {selectedBranchId && <BranchDetails />}
            </>
        ) : currentView === 'timeline' ? (<><TimelinePanel />{selectedBranchId && <BranchDetails />}</>) 
          : currentView === 'focus' ? <FocusPanel />
          : currentView === 'calendar' ? <CalendarPanel />
          : currentView === 'assignments' ? <UserTasksPanel />
          : currentView === 'settings' ? <SettingsPanel />
          : <div className="flex-1 p-4 md:p-8 overflow-auto"><PeopleManager /></div>
        }
      </div>

      <div className="md:hidden flex-shrink-0 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex justify-around items-center p-2 z-30 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button onClick={() => setCurrentView('workflow')} className={`flex flex-col items-center p-2 ${currentView === 'workflow' ? 'text-indigo-600' : 'text-slate-500'}`}><Layers className="w-6 h-6" /><span className="text-[10px] mt-1 font-black uppercase">Flow</span></button>
        <button onClick={() => setCurrentView('focus')} className={`flex flex-col items-center p-2 ${currentView === 'focus' ? 'text-indigo-600' : 'text-slate-500'}`}><Target className="w-6 h-6" /><span className="text-[10px] mt-1 font-black uppercase">Focus</span></button>
        <button onClick={() => setCurrentView('assignments')} className={`flex flex-col items-center p-2 ${currentView === 'assignments' ? 'text-indigo-600' : 'text-slate-500'}`}><ClipboardList className="w-6 h-6" /><span className="text-[10px] mt-1 font-black uppercase">Task</span></button>
        <button onClick={() => setCurrentView('calendar')} className={`flex flex-col items-center p-2 ${currentView === 'calendar' ? 'text-indigo-600' : 'text-slate-500'}`}><Calendar className="w-6 h-6" /><span className="text-[10px] mt-1 font-black uppercase">Date</span></button>
        <button onClick={() => setCurrentView('team')} className={`flex flex-col items-center p-2 ${currentView === 'team' ? 'text-indigo-600' : 'text-slate-500'}`}><Users className="w-6 h-6" /><span className="text-[10px] mt-1 font-black uppercase">Team</span></button>
      </div>
    </div>
  );
};

export default App;
