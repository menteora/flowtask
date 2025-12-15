import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './context/ThemeContext';
import { useProject } from './context/ProjectContext';
import { Moon, Sun, GitBranch, Layers, Users, Download, Upload, Archive, Camera, Image as ImageIcon, Smartphone, Plus, X, Edit2, Calendar, ClipboardList, Settings, Cloud, Loader2, Check, AlertCircle } from 'lucide-react';
import FlowCanvas from './components/flow/FlowCanvas';
import FolderTree from './components/flow/FolderTree';
import BranchDetails from './components/panels/BranchDetails';
import PeopleManager from './components/panels/PeopleManager';
import CalendarPanel from './components/panels/CalendarPanel';
import UserTasksPanel from './components/panels/UserTasksPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import LoginScreen from './components/auth/LoginScreen';
import DescriptionReader from './components/modals/DescriptionReader';
import TaskEditorModal from './components/modals/TaskEditorModal';
import MessageComposer from './components/modals/MessageComposer';
import { toPng } from 'html-to-image';

type View = 'workflow' | 'team' | 'calendar' | 'assignments' | 'settings';

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { 
    selectedBranchId, state, loadProject, showArchived, toggleShowArchived,
    projects, activeProjectId, switchProject, createProject, closeProject, renameProject,
    session, loadingAuth, isInitializing, isOfflineMode, autoSaveStatus
  } = useProject();
  
  const [currentView, setCurrentView] = useState<View>('workflow');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  // AUTH WALL & INITIALIZATION CHECK
  // 1. If initializing data (fetching from cloud), show loader
  if (isInitializing) {
      return (
          <div className="flex h-[100dvh] w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Caricamento...</p>
              </div>
          </div>
      );
  }

  // 2. If NOT offline mode AND (no session), show login.
  // We ignore loadingAuth if offline mode is active.
  if (!isOfflineMode) {
      if (!session && !loadingAuth) {
          return <LoginScreen />;
      }
      // Optional: Show loading state if still loading auth (though isInitializing usually covers this)
      if (loadingAuth) {
          return <LoginScreen />;
      }
  }

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    // Export the active project state
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
    
    if (!node) {
        alert("Passa alla vista 'Workflow' per esportare l'immagine del progetto.");
        return;
    }

    try {
        const bgColor = theme === 'dark' ? '#020617' : '#f8fafc'; 

        const style: React.CSSProperties = {
            backgroundColor: bgColor,
            display: 'block', 
            overflow: 'visible',
        };
        
        if (type === 'canvas') {
             style.width = `${node.scrollWidth}px`;
             style.height = `${node.scrollHeight}px`;
        }

        const dataUrl = await toPng(node, {
            cacheBust: true,
            backgroundColor: bgColor,
            style: style,
            width: type === 'canvas' ? node.scrollWidth : undefined,
            height: type === 'canvas' ? node.scrollHeight : undefined 
        });

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        link.download = `flowtask_${state.name.replace(/\s+/g, '_')}_${type}_${timestamp}.png`;
        link.href = dataUrl;
        link.click();

    } catch (err) {
        console.error("Export failed", err);
        alert("Errore durante l'esportazione dell'immagine.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        loadProject(json);
      } catch (err) {
        alert("Errore durante il caricamento del file JSON.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const NavItem = ({ view, icon: Icon, label }: { view: View; icon: any; label: string }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
        ${currentView === view 
          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />
      
      <DescriptionReader />
      <TaskEditorModal />
      <MessageComposer />

      {/* Header */}
      <div className="flex w-full h-14 md:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 items-center justify-between px-4 md:px-6 z-20 shadow-sm flex-shrink-0">
        
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <div className="bg-indigo-600 p-1.5 rounded-lg mr-2 md:mr-3">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              FlowTask
            </h1>
          </div>

          {/* Auto Save Status Indicator */}
          {session && !isOfflineMode && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded text-xs transition-colors ml-2 md:ml-0">
                  {autoSaveStatus === 'saving' && (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                        <span className="text-indigo-500 hidden sm:inline">Salvataggio...</span>
                      </>
                  )}
                  {autoSaveStatus === 'saved' && (
                      <>
                        <Cloud className="w-3 h-3 text-green-500" />
                        <span className="text-green-500 hidden sm:inline">Salvato</span>
                      </>
                  )}
                  {autoSaveStatus === 'error' && (
                      <>
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-red-500 hidden sm:inline">Errore Sync</span>
                      </>
                  )}
                  {autoSaveStatus === 'idle' && (
                      <span className="text-slate-400 hidden sm:inline">Pronto</span>
                  )}
              </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
           <NavItem view="workflow" icon={Layers} label="Workflow" />
           <NavItem view="assignments" icon={ClipboardList} label="Task" />
           <NavItem view="calendar" icon={Calendar} label="Scadenze" />
           <NavItem view="team" icon={Users} label="Team" />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={toggleShowArchived}
              className={`hidden md:block p-2 rounded-full transition-colors border ${showArchived ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 border-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent'}`}
              title={showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
            >
              <Archive className="w-4 h-4" />
            </button>
            
            <div className="hidden md:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

            <button 
                onClick={handleImageExport}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                title="Esporta Immagine"
            >
                <Camera className="w-4 h-4" />
            </button>

            <button 
              onClick={handleExport}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title="Esporta JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={handleImportClick}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title="Importa JSON (Nuova Tab)"
            >
              <Upload className="w-4 h-4" />
            </button>

            <div className="hidden md:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
            
             <button 
              onClick={() => setCurrentView('settings')}
              className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border ${currentView === 'settings' ? 'text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 dark:text-slate-400 border-transparent'}`}
              title="Impostazioni"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors border border-gray-200 dark:border-slate-700"
              title="Cambia tema"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
        </div>
      </div>

      {/* Tab Bar for Projects */}
      <div className="flex items-center w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar px-2 pt-2 gap-1 flex-shrink-0">
          {projects.map(proj => {
              const isActive = proj.id === activeProjectId;
              const isEditing = editingNameId === proj.id;

              return (
                  <div 
                    key={proj.id}
                    onClick={() => switchProject(proj.id)}
                    className={`
                        group flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg border-t border-x cursor-pointer min-w-[150px] max-w-[250px]
                        ${isActive 
                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 -mb-px pb-2.5 z-10' 
                            : 'bg-slate-200 dark:bg-slate-900/50 border-transparent text-slate-500 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-800'}
                    `}
                  >
                      {isEditing ? (
                          <input 
                            autoFocus
                            type="text"
                            defaultValue={proj.name}
                            onBlur={(e) => {
                                renameProject(e.target.value);
                                setEditingNameId(null);
                            }}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter') {
                                    renameProject(e.currentTarget.value);
                                    setEditingNameId(null);
                                }
                            }}
                            className="bg-transparent border-b border-indigo-500 outline-none w-full text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                      ) : (
                          <span className="truncate flex-1" onDoubleClick={() => setEditingNameId(proj.id)}>
                              {proj.name}
                          </span>
                      )}

                      {/* Edit Icon on hover (if active) */}
                      {isActive && !isEditing && (
                          <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 setEditingNameId(proj.id);
                             }}
                             className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 p-0.5"
                          >
                              <Edit2 className="w-3 h-3" />
                          </button>
                      )}
                      
                      {/* Close Tab */}
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            closeProject(proj.id);
                        }}
                        className={`p-0.5 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 ${projects.length === 1 ? 'opacity-30 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        disabled={projects.length === 1}
                      >
                          <X className="w-3.5 h-3.5" />
                      </button>
                  </div>
              );
          })}
          
          <button 
            onClick={createProject}
            className="ml-1 p-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors mb-1"
            title="Nuovo Progetto"
          >
              <Plus className="w-5 h-5" />
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {currentView === 'workflow' ? (
            <>
                <div className="hidden md:block w-full h-full relative">
                    <FlowCanvas />
                </div>

                <div className="block md:hidden w-full h-full">
                    <FolderTree />
                </div>

                {selectedBranchId && <BranchDetails />}
            </>
        ) : currentView === 'calendar' ? (
            <CalendarPanel />
        ) : currentView === 'assignments' ? (
            <UserTasksPanel />
        ) : currentView === 'settings' ? (
            <SettingsPanel />
        ) : (
            <div className="flex-1 p-4 md:p-8 overflow-auto">
                <PeopleManager />
            </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center p-2 z-30 pb-safe">
        <button 
            onClick={() => setCurrentView('workflow')}
            className={`flex flex-col items-center p-2 rounded-md ${currentView === 'workflow' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
        >
            <Layers className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Workflow</span>
        </button>
        <button 
            onClick={() => setCurrentView('assignments')}
            className={`flex flex-col items-center p-2 rounded-md ${currentView === 'assignments' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
        >
            <ClipboardList className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Task</span>
        </button>
        <button 
            onClick={() => setCurrentView('calendar')}
            className={`flex flex-col items-center p-2 rounded-md ${currentView === 'calendar' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
        >
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Scadenze</span>
        </button>
        <button 
            onClick={() => setCurrentView('team')}
            className={`flex flex-col items-center p-2 rounded-md ${currentView === 'team' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
        >
            <Users className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Team</span>
        </button>
         <button 
            onClick={() => setCurrentView('settings')}
            className={`flex flex-col items-center p-2 rounded-md ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
        >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Settings</span>
        </button>
      </div>

    </div>
  );
};

export default App;
