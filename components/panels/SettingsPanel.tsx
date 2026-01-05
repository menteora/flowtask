
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch, Task, Person, ProjectState } from '../../types';
import { 
  Database, Save, Download, Key, Check, Copy, Cloud, Loader2, Upload, 
  User, LogOut, X, Trash2, Eraser, AlertTriangle, Stethoscope, 
  Search, Square, CheckSquare, RefreshCw, MessageSquare, 
  Settings as SettingsIcon, ShieldCheck, Rocket, Eye, EyeOff, CheckCircle2, Code, DownloadCloud, Wifi, WifiOff,
  GitBranch, ListTodo, Users, FolderOpen
} from 'lucide-react';

const SQL_SCHEMA = `-- SCHEMA SQL FLOWTASK AGGIORNATO (SOFT DELETE + OCC)

-- PROGETTI
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  version integer default 1,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- PERSONE / TEAM
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text,
  version integer default 1,
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- RAMI / BRANCHES
create table public.flowtask_branches (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null,
  responsible_id text references public.flowtask_people(id) on delete set null,
  start_date text,
  end_date text,
  due_date text,
  archived boolean default false,
  collapsed boolean default false,
  is_label boolean default false,
  is_sprint boolean default false,
  sprint_counter integer default 1,
  parent_ids text[],
  children_ids text[],
  position integer default 0,
  version integer default 1,
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- TASKS
create table public.flowtask_tasks (
  id text primary key,
  branch_id text references public.flowtask_branches(id) on delete cascade,
  title text not null,
  description text,
  assignee_id text references public.flowtask_people(id) on delete set null,
  due_date text,
  completed boolean default false,
  completed_at text,
  position integer default 0,
  pinned boolean default false,
  version integer default 1,
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- TRIGGERS PER UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flowtask_projects_modtime BEFORE UPDATE ON public.flowtask_projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_flowtask_people_modtime BEFORE UPDATE ON public.flowtask_people FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_flowtask_branches_modtime BEFORE UPDATE ON public.flowtask_branches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_flowtask_tasks_modtime BEFORE UPDATE ON public.flowtask_tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();`;

type TabType = 'cloud' | 'sync' | 'diagnostics' | 'maintenance' | 'preferences';

interface DirtyRecordInfo {
    id: string;
    type: 'Project' | 'Person' | 'Branch' | 'Task';
    label: string;
    context?: string;
}

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, setSupabaseConfig, uploadProjectToSupabase, listProjectsFromSupabase,
    downloadProjectFromSupabase, deleteProjectFromSupabase, cleanupOldTasks,
    checkProjectHealth, repairProjectStructure, resolveOrphans,
    state, projects, session, logout, disableOfflineMode, showNotification,
    messageTemplates, updateMessageTemplates, supabaseClient, syncStatus, syncDirtyRecords, isOfflineMode
  } = useProject();

  const [activeTab, setActiveTab] = useState<TabType>('cloud');

  // Form States
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [msgOpening, setMsgOpening] = useState(messageTemplates.opening);
  const [msgClosing, setMsgClosing] = useState(messageTemplates.closing);

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [cleanupMonths, setCleanupMonths] = useState(6);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [healthReport, setHealthReport] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showSql, setShowSql] = useState(false);

  // Analisi record Dirty per la visualizzazione nella Tab Sync
  const dirtyItemsList = useMemo(() => {
    const list: DirtyRecordInfo[] = [];
    projects.forEach(p => {
        if (p.isDirty) list.push({ id: p.id, type: 'Project', label: p.name });
        p.people.forEach(pe => {
            if (pe.isDirty) list.push({ id: pe.id, type: 'Person', label: pe.name, context: p.name });
        });
        Object.values(p.branches).forEach((b: Branch) => {
            if (b.isDirty) list.push({ id: b.id, type: 'Branch', label: b.title, context: p.name });
            b.tasks.forEach((t: Task) => {
                if (t.isDirty) list.push({ id: t.id, type: 'Task', label: t.title, context: `${b.title} (${p.name})` });
            });
        });
    });
    return list;
  }, [projects]);

  useEffect(() => {
      setUrl(supabaseConfig.url);
      setKey(supabaseConfig.key);
      if (session && activeTab === 'cloud') {
          handleListProjects();
      }
  }, [supabaseConfig, session, activeTab]);

  const handleSaveConfig = () => {
      setSupabaseConfig(url, key);
      showNotification("Credenziali salvate correttamente.", 'success');
  };

  const handleSaveTemplates = () => {
      updateMessageTemplates({ opening: msgOpening, closing: msgClosing });
      showNotification("Template messaggi aggiornati.", 'success');
  };

  const copySqlToClipboard = () => {
      navigator.clipboard.writeText(SQL_SCHEMA);
      showNotification("Script SQL copiato!", 'success');
  };

  const handleListProjects = async () => {
      if (!session) return;
      setIsLoadingList(true);
      try {
          const list = await listProjectsFromSupabase();
          setRemoteProjects(list);
      } catch(e) {
          console.error("Errore recupero progetti", e);
      } finally { setIsLoadingList(false); }
  };

  const handleDownload = async (id: string) => {
      if (!confirm("Scaricare questo progetto sovrascriverà eventuali modifiche locali. Continuare?")) return;
      try {
          await downloadProjectFromSupabase(id, true, true);
          showNotification("Progetto scaricato!", 'success');
      } catch(e) {
          showNotification("Errore download.", 'error');
      }
  };

  const handleSyncNow = async () => {
      if (syncStatus.dirtyCount === 0) return;
      await syncDirtyRecords();
      showNotification("Sincronizzazione completata.", 'success');
  };

  const handleRunAnalysis = () => {
      setIsAnalyzing(true);
      setTimeout(() => {
          const report = checkProjectHealth();
          setHealthReport(report);
          setSelectedOrphans(report.orphanedBranches.map(o => o.id));
          setIsAnalyzing(false);
      }, 600);
  };

  const DirtyItemRow = ({ item }: { item: DirtyRecordInfo }) => {
    const icons = {
        Project: <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />,
        Person: <Users className="w-3.5 h-3.5 text-emerald-500" />,
        Branch: <GitBranch className="w-3.5 h-3.5 text-amber-500" />,
        Task: <ListTodo className="w-3.5 h-3.5 text-rose-500" />
    };

    return (
        <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <div className="shrink-0">
                {icons[item.type]}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{item.label || '(Senza nome)'}</p>
                {item.context && (
                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{item.context}</p>
                )}
            </div>
            <div className="shrink-0 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase">
                Dirty
            </div>
        </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-3 md:p-8 overflow-hidden relative">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 md:w-10 md:h-10 text-indigo-600" /> 
                Impostazioni
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Configurazione, Cloud e Sincronizzazione.</p>
        </div>
        {session ? (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">Account</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[120px] leading-none">{session.user.email}</span>
                    </div>
                </div>
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Logout"><LogOut className="w-4 h-4" /></button>
            </div>
        ) : (
            <button onClick={disableOfflineMode} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Connetti Cloud
            </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 overflow-x-auto scrollbar-hide -mx-3 px-3">
          {[
              { id: 'cloud', icon: Database, label: 'Cloud' },
              { id: 'sync', icon: RefreshCw, label: 'Sincronizzazione' },
              { id: 'diagnostics', icon: Stethoscope, label: 'Salute' },
              { id: 'maintenance', icon: Eraser, label: 'Pulizia' },
              { id: 'preferences', icon: MessageSquare, label: 'Template' }
          ].map(tab => (
            <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                <tab.icon className={`w-4 h-4 ${tab.id === 'sync' && syncStatus.dirtyCount > 0 ? 'text-amber-500' : ''}`} /> 
                {tab.label}
                {tab.id === 'sync' && syncStatus.dirtyCount > 0 && (
                    <span className="ml-1 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{syncStatus.dirtyCount}</span>
                )}
            </button>
          ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-20">
          {activeTab === 'cloud' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Database Remote</h3>
                              <p className="text-[10px] md:text-xs text-slate-500">Configurazione Supabase.</p>
                          </div>
                          <button onClick={() => setShowSql(!showSql)} className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg flex items-center gap-2">
                              <Code className="w-3.5 h-3.5" /> {showSql ? 'Nascondi SQL' : 'Mostra Schema SQL'}
                          </button>
                      </div>

                      {showSql && (
                          <div className="mb-6 animate-in zoom-in-95 duration-200">
                              <pre className="bg-slate-950 text-indigo-300 p-4 rounded-lg text-[10px] font-mono overflow-x-auto max-h-60 custom-scrollbar relative">
                                  <button onClick={copySqlToClipboard} className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded-md hover:text-white"><Copy className="w-3.5 h-3.5"/></button>
                                  {SQL_SCHEMA}
                              </pre>
                          </div>
                      )}

                      <div className="space-y-4">
                          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Supabase Project URL" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 font-mono" />
                          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 font-mono" />
                          <button onClick={handleSaveConfig} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700">Salva Configurazione</button>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><DownloadCloud className="w-5 h-5 text-indigo-500" /> Progetti nel Cloud</h3>
                      {session ? (
                          <div className="grid grid-cols-1 gap-2">
                              {isLoadingList ? (
                                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                              ) : remoteProjects.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-4 text-center">Nessun progetto cloud trovato.</p>
                              ) : (
                                  remoteProjects.map(proj => (
                                      <div key={proj.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                          <div className="min-w-0 pr-2">
                                              <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{proj.name}</p>
                                              <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(proj.created_at).toLocaleDateString()}</p>
                                          </div>
                                          <div className="flex gap-1">
                                              <button onClick={() => handleDownload(proj.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Scarica"><Download className="w-4 h-4" /></button>
                                              <button onClick={() => {if(confirm(`Eliminare (Soft Delete)?`)) deleteProjectFromSupabase(proj.id).then(handleListProjects)}} className="p-2 text-slate-300 hover:text-red-500" title="Elimina"><Trash2 className="w-4 h-4" /></button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      ) : (
                          <p className="text-center p-8 text-xs text-slate-400 italic border-2 border-dashed rounded-xl">Esegui l'accesso per caricare/scaricare progetti dal cloud.</p>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'sync' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex items-center justify-between mb-8">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><RefreshCw className={`w-5 h-5 ${syncStatus.isSyncing ? 'animate-spin' : ''} text-indigo-500`} /> Stato Sincronizzazione</h3>
                              <p className="text-xs text-slate-500">Gestione dei record modificati localmente.</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${isOfflineMode ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isOfflineMode ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                              {isOfflineMode ? 'Offline Mode' : 'Online'}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                              <span className={`text-4xl font-black ${syncStatus.dirtyCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{syncStatus.dirtyCount}</span>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Record da Sincronizzare</p>
                          </div>
                          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-3">
                              <button 
                                onClick={handleSyncNow}
                                disabled={syncStatus.dirtyCount === 0 || isOfflineMode || syncStatus.isSyncing}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-lg disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                  {syncStatus.isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                  Sincronizza Ora
                              </button>
                              <p className="text-[9px] text-slate-400 text-center italic">La sincronizzazione avviene automaticamente ogni 30 secondi.</p>
                          </div>
                      </div>

                      {syncStatus.dirtyCount > 0 && (
                          <div className="space-y-4 animate-in fade-in duration-300">
                               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Elenco record in attesa</h4>
                                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{dirtyItemsList.length} elementi</span>
                               </div>
                               <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                   {dirtyItemsList.map(item => (
                                       <DirtyItemRow key={`${item.type}-${item.id}`} item={item} />
                                   ))}
                               </div>
                          </div>
                      )}

                      {syncStatus.dirtyCount > 0 && !isOfflineMode && (
                          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-4">
                              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                              <div>
                                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Cambiamenti Pendenti</h4>
                                  <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 leading-relaxed">
                                      Hai dei record modificati localmente che non sono stati ancora salvati nel cloud. 
                                      Se chiudi l'applicazione o cancelli i dati del browser senza sincronizzare, queste modifiche andranno perse solo sul cloud, 
                                      ma rimarranno in questo browser (IndexedDB).
                                  </p>
                              </div>
                          </div>
                      )}
                      
                      {syncStatus.dirtyCount === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                               <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4">
                                   <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                               </div>
                               <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Tutto sincronizzato!</p>
                               <p className="text-[10px] mt-1">I tuoi dati locali sono allineati con il cloud.</p>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'diagnostics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 text-center">
                      <Eraser className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Manutenzione Progetto</h3>
                      <p className="text-xs text-slate-500">Usa gli strumenti di diagnostica per riparare rami orfani o pulire i task vecchi.</p>
                      <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg">Inizia Analisi Integrità</button>
                  </div>
              </div>
          )}

          {activeTab === 'maintenance' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Pulizia Massiva</h3>
                      <div className="space-y-4">
                          <label className="text-xs text-slate-500">Elimina task chiusi da più di:</label>
                          <select value={cleanupMonths} onChange={(e) => setCleanupMonths(parseInt(e.target.value))} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-lg text-sm">
                              <option value={1}>1 Mese</option>
                              <option value={3}>3 Mesi</option>
                              <option value={6}>6 Mesi</option>
                              <option value={12}>1 Anno</option>
                          </select>
                          <button onClick={() => setShowCleanupConfirm(true)} className="w-full py-3 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase shadow-md">Avvia Pulizia</button>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-500" /> Template Messaggi</h3>
                      <div className="space-y-4">
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block">Apertura</label>
                              <textarea value={msgOpening} onChange={(e) => setMsgOpening(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 min-h-[80px]" />
                          </div>
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block">Chiusura</label>
                              <textarea value={msgClosing} onChange={(e) => setMsgClosing(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 min-h-[80px]" />
                          </div>
                          <button onClick={handleSaveTemplates} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg">Salva Template</button>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {showCleanupConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-sm rounded-3xl p-6 text-center shadow-2xl">
                  <AlertTriangle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
                  <h3 className="text-xl font-black uppercase">Conferma Pulizia</h3>
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">Questa azione marcerà come eliminati i task completati oltre la soglia scelta. Procedere?</p>
                  <div className="flex gap-2 mt-8">
                      <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase">Annulla</button>
                      <button onClick={async () => {setIsCleaning(true); await cleanupOldTasks(cleanupMonths); setIsCleaning(false); setShowCleanupConfirm(false);}} disabled={isCleaning} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                        {isCleaning && <Loader2 className="w-3 h-3 animate-spin" />} Conferma
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsPanel;
