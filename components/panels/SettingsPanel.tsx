
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { Database, Save, Download, Key, Check, Copy, Terminal, Cloud, Loader2, Upload, User, LogOut, WifiOff, X, Link, Trash2, Eraser, AlertTriangle, Stethoscope, Search, Square, CheckSquare, RefreshCw, Tag, GitBranch, Calendar } from 'lucide-react';

const SQL_SCHEMA = `
-- CANCELLAZIONE VECCHIE TABELLE (Se esistono)
DROP TABLE IF EXISTS public.flowtask_tasks;
DROP TABLE IF EXISTS public.flowtask_branches;
DROP TABLE IF EXISTS public.flowtask_people;
DROP TABLE IF EXISTS public.flowtask_projects;

-- CREAZIONE NUOVE TABELLE CON RLS
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text
);

create table public.flowtask_branches (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null,
  start_date text,
  end_date text,
  due_date text,
  archived boolean default false,
  collapsed boolean default false,
  is_label boolean default false,
  parent_ids text[],
  children_ids text[],
  position integer default 0
);

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
  pinned boolean default false
);

alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

create policy "Users can all on own projects" on public.flowtask_projects for all using (auth.uid() = owner_id);
create policy "Users can all on people of own projects" on public.flowtask_people for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_people.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on branches of own projects" on public.flowtask_branches for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_branches.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on tasks of own projects" on public.flowtask_tasks for all using (exists (select 1 from public.flowtask_branches join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id where public.flowtask_branches.id = public.flowtask_tasks.branch_id and public.flowtask_projects.owner_id = auth.uid()));
`;

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, 
    setSupabaseConfig, 
    uploadProjectToSupabase, 
    listProjectsFromSupabase,
    downloadProjectFromSupabase,
    deleteProjectFromSupabase,
    cleanupOldTasks,
    checkProjectHealth,
    repairProjectStructure,
    resolveOrphans,
    state,
    session,
    logout,
    disableOfflineMode,
    isOfflineMode,
    showNotification,
    messageTemplates,
    updateMessageTemplates
  } = useProject();

  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [copied, setCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cleanupMonths, setCleanupMonths] = useState(6);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [healthReport, setHealthReport] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);
  const [isRepairing, setIsRepairing] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);

  const cleanupStats = useMemo(() => {
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - cleanupMonths);
    let count = 0;
    (Object.values(state.branches) as Branch[]).forEach(b => {
        b.tasks.forEach(t => {
            if (t.completed && t.completedAt) {
                const cDate = new Date(t.completedAt);
                if (cDate < threshold) count++;
            }
        });
    });
    return count;
  }, [state.branches, cleanupMonths]);

  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setUrl(supabaseConfig.url);
      setKey(supabaseConfig.key);
      if (session) {
          handleListProjects();
      }
  }, [supabaseConfig, session]);

  const handleSaveConfig = () => {
      setSupabaseConfig(url, key);
      showNotification("Credenziali salvate nel browser.", 'success');
  };

  const handleCopySql = () => {
      navigator.clipboard.writeText(SQL_SCHEMA);
      setCopied(true);
      showNotification("Codice SQL copiato!", 'success');
      setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateShareLink = () => {
      if (!url || !key) return;
      const encoded = btoa(JSON.stringify({ url, key }));
      const link = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
      navigator.clipboard.writeText(link);
      setShareLinkCopied(true);
      showNotification("Link di configurazione copiato!", 'success');
      setTimeout(() => setShareLinkCopied(false), 3000);
  };

  const handleExportConfig = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ url, key }, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "flowtask_supabase_config.json");
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportConfigClick = () => fileInputRef.current?.click();

  const handleImportConfigFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.url && json.key) {
            setUrl(json.url); setKey(json.key); setSupabaseConfig(json.url, json.key); 
            showNotification("Configurazione importata!", 'success');
        }
      } catch (err) { console.error(err); }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleCloudSave = async () => {
      if (!session) return;
      setIsSaving(true);
      try {
          await uploadProjectToSupabase();
          setSaveStatus('success');
          showNotification("Progetto salvato con successo nel cloud!", 'success');
          handleListProjects();
          setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) { 
          setSaveStatus('error'); 
          showNotification("Errore durante il salvataggio cloud.", 'error');
      } finally { setIsSaving(false); }
  };

  const handleListProjects = async () => {
      if (!session) return;
      setIsLoadingList(true);
      try {
          const list = await listProjectsFromSupabase();
          setRemoteProjects(list);
      } catch(e) {
          console.error("Errore recupero progetti remoti", e);
      } finally { setIsLoadingList(false); }
  };

  const handleDownload = async (id: string) => {
      if (!confirm("Scaricare questo progetto sovrascriverà eventuali modifiche locali non sincronizzate. Continuare?")) return;
      setIsDownloading(true);
      try {
          await downloadProjectFromSupabase(id, true, true);
          showNotification("Progetto scaricato e attivato!", 'success');
      } catch(e) {
          showNotification("Errore durante il download del progetto.", 'error');
      } finally { setIsDownloading(false); }
  };

  const handleDeleteRemote = async (id: string, name: string) => {
      if (!confirm(`Sei sicuro di voler eliminare DEFINITIVAMENTE il progetto "${name}" dal cloud?`)) return;
      try {
          await deleteProjectFromSupabase(id);
          showNotification("Progetto eliminato dal cloud.", 'success');
          handleListProjects();
      } catch(e) {
          showNotification("Errore durante l'eliminazione remota.", 'error');
      }
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

  const toggleOrphanSelection = (id: string) => {
      setSelectedOrphans(prev => prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]);
  };

  const handleFixRootIssues = () => {
      repairProjectStructure();
      const report = checkProjectHealth();
      setHealthReport(report);
      setSelectedOrphans(report.orphanedBranches.map(o => o.id));
  };

  const handleRestoreSelectedOrphans = () => {
      setIsRepairing(true);
      resolveOrphans(selectedOrphans, []);
      setHealthReport(null);
      setIsRepairing(false);
  };

  const handleDeleteSelectedOrphans = () => {
      if (!confirm(`Sei sicuro di voler ELIMINARE DEFINITIVAMENTE ${selectedOrphans.length} rami e tutti i relativi task?`)) return;
      setIsRepairing(true);
      resolveOrphans([], selectedOrphans);
      setHealthReport(null);
      setIsRepairing(false);
  };

  const handleRunCleanup = async () => {
      setIsCleaning(true);
      try {
          const result = await cleanupOldTasks(cleanupMonths);
          showNotification(`Pulizia completata: ${result.count} task rimossi.`, 'success');
          setShowCleanupConfirm(false);
      } catch(e) {
          showNotification("Errore durante la pulizia.", 'error');
      } finally { setIsCleaning(false); }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-3 md:p-8 overflow-y-auto overflow-x-hidden pb-20 relative">
      <input type="file" ref={fileInputRef} onChange={handleImportConfigFile} accept=".json" className="hidden" />

      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Database className="w-8 h-8 text-indigo-600" /> Configurazione
            </h2>
        </div>
        {session ? (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{session.user.email}</span>
                </div>
                <button onClick={logout} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Logout"><LogOut className="w-4 h-4" /></button>
            </div>
        ) : (
            <button onClick={disableOfflineMode} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Connetti Account</button>
        )}
      </div>

      <div className="grid gap-6 md:gap-8">
          {/* Cloud Sync Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-indigo-500" /> Sincronizzazione Cloud
                  </h3>
                  {session && (
                      <button 
                        onClick={handleCloudSave}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-md ${saveStatus === 'success' ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}
                      >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {saveStatus === 'success' ? 'Salvato!' : 'Salva su Cloud'}
                      </button>
                  )}
              </div>

              {session ? (
                  <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Progetti disponibili nel Cloud</h4>
                          <button onClick={handleListProjects} disabled={isLoadingList} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                              {isLoadingList ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Aggiorna Lista
                          </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {remoteProjects.length === 0 ? (
                              <p className="text-sm text-slate-400 italic py-4 text-center">Nessun progetto trovato nel cloud.</p>
                          ) : (
                              remoteProjects.map(proj => (
                                  <div key={proj.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                                      <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{proj.name}</span>
                                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {new Date(proj.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => handleDownload(proj.id)}
                                            disabled={isDownloading}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md"
                                            title="Scarica e attiva"
                                          >
                                              <Download className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteRemote(proj.id, proj.name)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                                            title="Elimina dal cloud"
                                          >
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      <WifiOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Connettiti per sincronizzare i tuoi progetti nel cloud.</p>
                  </div>
              )}
          </div>

          {/* Diagnostics Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-rose-500" />
                  Salute del Progetto & Diagnostica
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  Identifica e ripara problemi strutturali o rami isolati dal flusso principale.
              </p>

              {!healthReport ? (
                   <button 
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                    className="w-full py-4 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                      {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <Search className="w-6 h-6 text-slate-400" />}
                      <span className="font-bold text-sm text-slate-600 dark:text-slate-400">{isAnalyzing ? 'Analisi in corso...' : 'Avvia Diagnostica'}</span>
                  </button>
              ) : (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                      {/* Critical Root Issues */}
                      {(healthReport.legacyRootFound || healthReport.missingRootNode) && (
                          <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl">
                              <div className="flex items-start gap-3">
                                  <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5" />
                                  <div className="flex-1">
                                      <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Problemi Radice Rilevati</p>
                                      <ul className="text-xs text-rose-700 dark:text-rose-400 mt-1 list-disc ml-4 space-y-1">
                                          {healthReport.legacyRootFound && <li>Trovato ID radice legacy ('root'). Va migrato a UUID univoco.</li>}
                                          {healthReport.missingRootNode && <li>Il nodo di partenza dichiarato non esiste fisicamente.</li>}
                                      </ul>
                                  </div>
                                  <button 
                                    onClick={handleFixRootIssues}
                                    className="px-3 py-1.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 shadow-sm"
                                  >
                                      Fix Radice
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* Orphaned Branches */}
                      <div>
                          <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                  Rami Orfani / Task Isolati ({healthReport.orphanedBranches.length})
                              </h4>
                              {healthReport.orphanedBranches.length > 0 && (
                                  <div className="flex gap-2">
                                      <button 
                                        onClick={() => setSelectedOrphans(healthReport.orphanedBranches.map(o => o.id))}
                                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                                      >Seleziona Tutti</button>
                                      <button 
                                        onClick={() => setSelectedOrphans([])}
                                        className="text-[10px] font-bold text-slate-400 hover:underline"
                                      >Deseleziona</button>
                                  </div>
                              )}
                          </div>

                          {healthReport.orphanedBranches.length === 0 ? (
                              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                                  <Check className="w-5 h-5 text-emerald-500" />
                                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Nessun ramo orfano trovato. Il progetto è integro.</span>
                              </div>
                          ) : (
                              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                  {healthReport.orphanedBranches.map((orphan: any) => {
                                      const statusCfg = STATUS_CONFIG[orphan.status as keyof typeof STATUS_CONFIG];
                                      const progressPct = orphan.taskCount > 0 ? (orphan.completedCount / orphan.taskCount) * 100 : 0;
                                      
                                      return (
                                          <div 
                                            key={orphan.id} 
                                            onClick={() => toggleOrphanSelection(orphan.id)}
                                            className={`flex items-start justify-between p-3 rounded-lg border transition-all cursor-pointer ${selectedOrphans.includes(orphan.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
                                          >
                                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                                  {selectedOrphans.includes(orphan.id) ? <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" /> : <Square className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
                                                  <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-2 mb-1">
                                                          {orphan.isLabel ? <Tag className="w-3.5 h-3.5 text-amber-500" /> : <GitBranch className="w-3.5 h-3.5 text-indigo-500" />}
                                                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{orphan.title || '(Senza Titolo)'}</p>
                                                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border border-current ${statusCfg?.color || 'text-slate-400'}`}>
                                                              {orphan.status}
                                                          </span>
                                                      </div>
                                                      
                                                      <div className="flex items-center gap-4 text-[10px]">
                                                           <div className="flex flex-col gap-1 w-32">
                                                                <div className="flex justify-between text-slate-500 font-bold uppercase tracking-tighter">
                                                                    <span>Progressi</span>
                                                                    <span>{orphan.completedCount}/{orphan.taskCount}</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progressPct}%` }} />
                                                                </div>
                                                           </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>

                      {/* Actions for Orphans */}
                      {selectedOrphans.length > 0 && (
                          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                              <div className="flex-1">
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedOrphans.length} rami selezionati</p>
                                  <p className="text-[10px] text-slate-500">I rami ripristinati verranno collegati al nodo radice del progetto.</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                  <button 
                                    onClick={handleRestoreSelectedOrphans}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm"
                                  >
                                      <RefreshCw className="w-3.5 h-3.5" /> Ripristina
                                  </button>
                                  <button 
                                    onClick={handleDeleteSelectedOrphans}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 flex items-center justify-center gap-2 shadow-sm"
                                  >
                                      <Trash2 className="w-3.5 h-3.5" /> Elimina
                                  </button>
                              </div>
                          </div>
                      )}
                      
                      <div className="flex justify-center pt-2">
                          <button onClick={() => setHealthReport(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase tracking-tighter">Chiudi Report</button>
                      </div>
                  </div>
              )}
          </div>

          {/* Cleanup Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <Eraser className="w-5 h-5 text-amber-500" /> Manutenzione & Pulizia
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Rimuovi i task chiusi da tempo per alleggerire il progetto.</p>
              <div className="flex flex-col md:flex-row md:items-center gap-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-center">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Anzianità Task (Mesi)</label>
                          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded text-xs font-black">{cleanupMonths} m+</span>
                      </div>
                      <input type="range" min="1" max="24" value={cleanupMonths} onChange={(e) => setCleanupMonths(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                  <button onClick={() => setShowCleanupConfirm(true)} disabled={cleanupStats === 0} className="md:self-end px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-500/20 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      <Eraser className="w-4 h-4" /> Avvia Pulizia
                  </button>
              </div>
          </div>

          {/* API Credentials */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Credenziali API</h3>
                  <button onClick={handleGenerateShareLink} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg flex items-center gap-2">{shareLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />} Condividi Config</button>
              </div>
              <div className="space-y-4">
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Supabase Project URL" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                  <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Supabase Anon Public Key" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveConfig} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium">Aggiorna Credenziali</button>
                    <button onClick={handleExportConfig} title="Esporta configurazione JSON" className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-sm"><Download className="w-4 h-4" /></button>
                    <button onClick={handleImportConfigClick} title="Importa configurazione JSON" className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-sm"><Upload className="w-4 h-4" /></button>
                  </div>
              </div>
          </div>

          {/* SQL Setup Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-slate-500" /> Configurazione Database (SQL)
                  </h3>
                  <button 
                    onClick={() => setShowSqlSchema(!showSqlSchema)} 
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                      {showSqlSchema ? 'Nascondi Codice' : 'Mostra Codice'}
                  </button>
              </div>
              
              {showSqlSchema && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Copia questo codice ed eseguilo nello <strong>SQL Editor</strong> di Supabase per creare le tabelle e le policy RLS necessarie.
                      </p>
                      <div className="relative group">
                          <pre className="p-4 bg-slate-900 text-slate-300 rounded-lg text-[11px] font-mono overflow-x-auto max-h-96 custom-scrollbar">
                              {SQL_SCHEMA}
                          </pre>
                          <button 
                            onClick={handleCopySql} 
                            className="absolute top-2 right-2 p-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors shadow-lg"
                            title="Copia SQL"
                          >
                              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Cleanup Confirmation Modal */}
      {showCleanupConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-6">
                  <div className="flex flex-col items-center text-center gap-4">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Conferma Pulizia</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                              Stai per eliminare definitivamente <strong>{cleanupStats} task</strong> chiusi da oltre {cleanupMonths} mesi.
                              <br/><br/>
                              Questa azione non può essere annullata.
                          </p>
                      </div>
                      <div className="flex gap-3 w-full mt-2">
                          <button 
                            onClick={() => setShowCleanupConfirm(false)}
                            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
                          >
                              Annulla
                          </button>
                          <button 
                            onClick={handleRunCleanup}
                            disabled={isCleaning}
                            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                          >
                              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              Esegui Pulizia
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsPanel;
