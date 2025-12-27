
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { 
  Database, Save, Download, Key, Check, Copy, Terminal, Cloud, Loader2, Upload, 
  User, LogOut, WifiOff, X, Link, Trash2, Eraser, AlertTriangle, Stethoscope, 
  Search, Square, CheckSquare, RefreshCw, Tag, GitBranch, Calendar, Info, 
  MessageSquare, Settings as SettingsIcon, ShieldCheck, Rocket, ChevronRight
} from 'lucide-react';

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

type TabType = 'cloud' | 'diagnostics' | 'maintenance' | 'preferences';

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, setSupabaseConfig, uploadProjectToSupabase, listProjectsFromSupabase,
    downloadProjectFromSupabase, deleteProjectFromSupabase, cleanupOldTasks,
    checkProjectHealth, repairProjectStructure, resolveOrphans,
    state, session, logout, disableOfflineMode, showNotification,
    messageTemplates, updateMessageTemplates
  } = useProject();

  const [activeTab, setActiveTab] = useState<TabType>('cloud');

  // Form States
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [msgOpening, setMsgOpening] = useState(messageTemplates.opening);
  const [msgClosing, setMsgClosing] = useState(messageTemplates.closing);

  // UI States
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCloudSave = async () => {
      if (!session) return;
      setIsSaving(true);
      try {
          await uploadProjectToSupabase();
          setSaveStatus('success');
          showNotification("Progetto salvato nel cloud!", 'success');
          handleListProjects();
          setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e) { 
          setSaveStatus('error'); 
          showNotification("Errore salvataggio cloud.", 'error');
      } finally { setIsSaving(false); }
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
      setIsDownloading(true);
      try {
          await downloadProjectFromSupabase(id, true, true);
          showNotification("Progetto scaricato e attivato!", 'success');
      } catch(e) {
          showNotification("Errore download.", 'error');
      } finally { setIsDownloading(false); }
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

  const handleFixRootIssues = async () => {
      setIsRepairing(true);
      try {
          const success = await repairProjectStructure();
          if (success) {
            // Dopo il fix, rifai l'analisi per aggiornare l'UI e mostrare che Fase 1 è risolta
            const report = checkProjectHealth();
            setHealthReport(report);
            setSelectedOrphans(report.orphanedBranches.map(o => o.id));
          }
      } finally {
          setIsRepairing(false);
      }
  };

  const handleRestoreSelectedOrphans = () => {
      setIsRepairing(true);
      resolveOrphans(selectedOrphans, []);
      // Resetta il report per forzare una nuova analisi manuale o pulire la vista
      setHealthReport(null);
      setIsRepairing(false);
      showNotification("Rami ripristinati correttamente.", 'success');
  };

  const handleRunCleanup = async () => {
      setIsCleaning(true);
      try {
          const result = await cleanupOldTasks(cleanupMonths);
          showNotification(`Rimossi ${result.count} task obsoleti.`, 'success');
          setShowCleanupConfirm(false);
      } finally { setIsCleaning(false); }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-3 md:p-8 overflow-hidden relative">
      
      {/* Header statico */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 md:w-10 md:h-10 text-indigo-600" /> 
                Impostazioni
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestisci la configurazione e la salute dei dati.</p>
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
                <Cloud className="w-4 h-4" /> Connetti
            </button>
        )}
      </div>

      {/* Tabs Switcher - Responsive with scroll */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 overflow-x-auto scrollbar-hide -mx-3 px-3">
          {[
              { id: 'cloud', icon: Database, label: 'Cloud' },
              { id: 'diagnostics', icon: Stethoscope, label: 'Salute' },
              { id: 'maintenance', icon: Eraser, label: 'Pulizia' },
              { id: 'preferences', icon: MessageSquare, label: 'Template' }
          ].map(tab => (
            <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-3 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-20">
          
          {/* TAB: CLOUD & DATABASE */}
          {activeTab === 'cloud' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Database</h3>
                              <p className="text-[10px] md:text-xs text-slate-500">Configura la connessione Supabase.</p>
                          </div>
                          <button onClick={handleGenerateShareLink} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg flex items-center gap-2 w-fit">
                              {shareLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />} {shareLinkCopied ? 'Link Copiato' : 'Condividi Config'}
                          </button>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Project URL</label>
                              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono" />
                          </div>
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Anon Key</label>
                              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-mono" />
                          </div>
                          <button onClick={handleSaveConfig} className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold">Salva Credenziali</button>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-indigo-500" /> Cloud Sync</h3>
                          {session && (
                              <button onClick={handleCloudSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md">
                                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Salva Ora
                              </button>
                          )}
                      </div>

                      {session ? (
                          <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400">Progetti Remoti</h4>
                                  <button onClick={handleListProjects} disabled={isLoadingList} className="text-[10px] text-indigo-600 flex items-center gap-1 font-bold">
                                      {isLoadingList ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Aggiorna
                                  </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                  {remoteProjects.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic py-4 text-center">Nessun progetto nel cloud.</p>
                                  ) : (
                                      remoteProjects.map(proj => (
                                          <div key={proj.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50">
                                              <div className="min-w-0 pr-2">
                                                  <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{proj.name}</p>
                                                  <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(proj.created_at).toLocaleDateString()}</p>
                                              </div>
                                              <div className="flex gap-1 shrink-0">
                                                  <button onClick={() => handleDownload(proj.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Download className="w-4 h-4" /></button>
                                                  <button onClick={() => {if(confirm(`Eliminare ${proj.name}?`)) deleteProjectFromSupabase(proj.id).then(handleListProjects)}} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 rounded-2xl">
                              <WifiOff className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs font-medium text-slate-500">Accedi per usare il cloud.</p>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* TAB: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="mb-6">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                              <Stethoscope className="w-6 h-6 text-rose-500" /> Diagnostica
                          </h3>
                          <p className="text-xs text-slate-500">Risolvi problemi di rami isolati o radici legacy.</p>
                      </div>

                      {!healthReport ? (
                           <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="w-full py-10 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3">
                              {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin text-indigo-500" /> : <Search className="w-8 h-8 text-slate-400" />}
                              <span className="font-black text-slate-500 uppercase text-[10px] tracking-widest">{isAnalyzing ? 'Analisi...' : 'Avvia Check'}</span>
                          </button>
                      ) : (
                          <div className="space-y-8">
                              {/* PHASE 1: ROOT REPAIR */}
                              <div className={`p-4 rounded-2xl border transition-all ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800'}`}>
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                          { (healthReport.legacyRootFound || healthReport.missingRootNode) ? <AlertTriangle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-600' : 'bg-emerald-600'}`}>FASE 1</span>
                                              <p className={`text-sm font-bold ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'text-rose-800 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                                                  { (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'Riparazione Radice Richiesta' : 'Radice Integra'}
                                              </p>
                                          </div>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                              { (healthReport.legacyRootFound || healthReport.missingRootNode) 
                                                ? "Il sistema ha rilevato errori strutturali critici. Esegui il Fix prima di recuperare i rami orfani." 
                                                : "La struttura principale del progetto è corretta." }
                                          </p>
                                      </div>
                                      {(healthReport.legacyRootFound || healthReport.missingRootNode) && (
                                          <button 
                                            onClick={handleFixRootIssues} 
                                            disabled={isRepairing} 
                                            className="w-full sm:w-auto px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2"
                                          >
                                              {isRepairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} FIX RADICE
                                          </button>
                                      )}
                                  </div>
                              </div>

                              {/* PHASE 2: ORPHAN RECOVERY */}
                              <div className={ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'opacity-40 grayscale pointer-events-none' : ''}>
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                          <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">FASE 2</span>
                                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rami Orfani ({healthReport.orphanedBranches.length})</h4>
                                      </div>
                                  </div>

                                  {healthReport.orphanedBranches.length === 0 ? (
                                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                                          <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                          <p className="text-xs font-bold text-slate-500">Tutti i rami sono collegati correttamente.</p>
                                      </div>
                                  ) : (
                                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                          {healthReport.orphanedBranches.map((orphan: any) => (
                                              <div key={orphan.id} onClick={() => setSelectedOrphans(prev => prev.includes(orphan.id) ? prev.filter(id => id !== orphan.id) : [...prev, orphan.id])} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedOrphans.includes(orphan.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 border-slate-100'}`}>
                                                  {selectedOrphans.includes(orphan.id) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-200" />}
                                                  <div className="min-w-0 flex-1">
                                                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{orphan.title || '(Senza Titolo)'}</p>
                                                      <p className="text-[9px] text-slate-400 font-bold uppercase">{orphan.status}</p>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}

                                  {selectedOrphans.length > 0 && (
                                      <div className="mt-4 flex gap-2">
                                          <button onClick={handleRestoreSelectedOrphans} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                                              <RefreshCw className="w-4 h-4" /> Ripristina Selezionati
                                          </button>
                                      </div>
                                  )}
                              </div>
                              <div className="flex justify-center pt-2">
                                  <button onClick={() => setHealthReport(null)} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chiudi Report</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* TAB: MAINTENANCE */}
          {activeTab === 'maintenance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 text-center sm:text-left">
                      <div className="mb-6">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Eraser className="w-6 h-6 text-amber-500" /> Pulizia Task</h3>
                          <p className="text-xs text-slate-500">Libera spazio eliminando i task vecchi.</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 p-6 flex flex-col items-center gap-6">
                          <div className="w-full">
                              <div className="flex justify-between items-end mb-4">
                                  <label className="text-[10px] font-black text-slate-400 uppercase">Anzianità</label>
                                  <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-black">{cleanupMonths} Mesi</span>
                              </div>
                              <input type="range" min="1" max="24" value={cleanupMonths} onChange={(e) => setCleanupMonths(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 shadow-xl w-full max-w-[240px]">
                              <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{cleanupStats}</span>
                              <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Task Trovati</p>
                              <button onClick={() => setShowCleanupConfirm(true)} disabled={cleanupStats === 0} className="w-full mt-4 py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase disabled:opacity-30">Avvia Pulizia</button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-500" /> Template</h3>
                      <p className="text-xs text-slate-500 mb-6">Personalizza i solleciti WhatsApp/Email.</p>
                      <div className="space-y-5">
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block">Testo Apertura</label>
                              <textarea value={msgOpening} onChange={(e) => setMsgOpening(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-none h-24" />
                          </div>
                          <div>
                              <label className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block">Testo Chiusura</label>
                              <textarea value={msgClosing} onChange={(e) => setMsgClosing(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 outline-none h-24" />
                          </div>
                          <button onClick={handleSaveTemplates} className="w-full sm:w-auto px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black">Salva Template</button>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Cleanup Modal */}
      {showCleanupConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 text-center animate-in zoom-in-95">
                  <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                  <h3 className="text-xl font-black uppercase">Conferma Pulizia</h3>
                  <p className="text-xs text-slate-500 mt-2">Questa azione eliminerà {cleanupStats} task chiusi e non potrà essere annullata.</p>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 py-3 bg-slate-100 rounded-xl text-[10px] font-black uppercase">Annulla</button>
                      <button onClick={handleRunCleanup} disabled={isCleaning} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">Conferma</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsPanel;
