
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { STATUS_CONFIG } from '../../constants';
import { 
  Database, Save, Download, Key, Check, Copy, Terminal, Cloud, Loader2, Upload, 
  User, LogOut, WifiOff, X, Link, Trash2, Eraser, AlertTriangle, Stethoscope, 
  Search, Square, CheckSquare, RefreshCw, Tag, GitBranch, Calendar, Info, 
  MessageSquare, Settings as SettingsIcon, ShieldCheck
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
          await repairProjectStructure();
          const report = checkProjectHealth();
          setHealthReport(report);
          setSelectedOrphans(report.orphanedBranches.map(o => o.id));
      } finally {
          setIsRepairing(false);
      }
  };

  const handleRestoreSelectedOrphans = () => {
      setIsRepairing(true);
      resolveOrphans(selectedOrphans, []);
      setHealthReport(null);
      setIsRepairing(false);
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
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-hidden relative">
      
      {/* Header statico */}
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-10 h-10 text-indigo-600 animate-pulse-slow" /> 
                Impostazioni
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestisci la configurazione, la sicurezza e la salute dei tuoi dati.</p>
        </div>
        {session ? (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">Connesso come</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate max-w-[150px] leading-none">{session.user.email}</span>
                    </div>
                </div>
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Logout"><LogOut className="w-4 h-4" /></button>
            </div>
        ) : (
            <button onClick={disableOfflineMode} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Connetti Account
            </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button 
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'cloud' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <Database className="w-4 h-4" /> Database & Cloud
          </button>
          <button 
            onClick={() => setActiveTab('diagnostics')}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'diagnostics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <Stethoscope className="w-4 h-4" /> Diagnostica
          </button>
          <button 
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'maintenance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <Eraser className="w-4 h-4" /> Manutenzione
          </button>
          <button 
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'preferences' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
              <MessageSquare className="w-4 h-4" /> Preferenze
          </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
          
          {/* TAB: CLOUD & DATABASE */}
          {activeTab === 'cloud' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  
                  {/* API Credentials Card */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Credenziali Supabase</h3>
                              <p className="text-xs text-slate-500">Configura la connessione per abilitare la sincronizzazione.</p>
                          </div>
                          <button onClick={handleGenerateShareLink} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                              {shareLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />} {shareLinkCopied ? 'Link Copiato' : 'Condividi Config'}
                          </button>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Project URL</label>
                              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono" />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Anon Key</label>
                              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ..." className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono" />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button onClick={handleSaveConfig} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/10 transition-all">Applica Credenziali</button>
                          </div>
                      </div>
                  </div>

                  {/* Cloud Sync Section */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                  <Cloud className="w-5 h-5 text-indigo-500" /> I tuoi Progetti nel Cloud
                              </h3>
                              <p className="text-xs text-slate-500">Salva o scarica i tuoi flussi di lavoro dai server remoti.</p>
                          </div>
                          {session && (
                              <button 
                                onClick={handleCloudSave}
                                disabled={isSaving}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all shadow-lg ${saveStatus === 'success' ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'} disabled:opacity-50`}
                              >
                                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                  {saveStatus === 'success' ? 'Progetto Sincronizzato!' : 'Salva su Cloud'}
                              </button>
                          )}
                      </div>

                      {session ? (
                          <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Remote Projects Archive</h4>
                                  <button onClick={handleListProjects} disabled={isLoadingList} className="text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center gap-1">
                                      {isLoadingList ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Aggiorna Lista
                                  </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                                  {remoteProjects.length === 0 ? (
                                      <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                          <p className="text-sm text-slate-400 italic">Nessun progetto trovato nel tuo account cloud.</p>
                                      </div>
                                  ) : (
                                      remoteProjects.map(proj => (
                                          <div key={proj.id} className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 transition-all hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200">
                                              <div className="flex flex-col min-w-0">
                                                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{proj.name}</span>
                                                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase"><Calendar className="w-2.5 h-2.5" /> {new Date(proj.created_at).toLocaleDateString()}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                  <button 
                                                    onClick={() => handleDownload(proj.id)}
                                                    disabled={isDownloading}
                                                    className="p-2.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                                                    title="Scarica e sovrascrivi locale"
                                                  >
                                                      <Download className="w-5 h-5" />
                                                  </button>
                                                  <button 
                                                    onClick={async () => {
                                                        if(confirm(`Eliminare ${proj.name} dal cloud?`)) {
                                                            await deleteProjectFromSupabase(proj.id);
                                                            handleListProjects();
                                                        }
                                                    }}
                                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                    title="Elimina definitivo dal cloud"
                                                  >
                                                      <Trash2 className="w-5 h-5" />
                                                  </button>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="p-10 text-center bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-3">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                  <WifiOff className="w-6 h-6 text-slate-300" />
                              </div>
                              <p className="text-sm font-medium text-slate-500">Connettiti per visualizzare i tuoi progetti nel cloud.</p>
                          </div>
                      )}
                  </div>

                  {/* SQL Setup Section */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                  <Terminal className="w-5 h-5 text-slate-500" /> Configurazione Database (SQL)
                              </h3>
                              <p className="text-xs text-slate-500">Codice schema per lo SQL Editor di Supabase.</p>
                          </div>
                          <button 
                            onClick={() => setShowSqlSchema(!showSqlSchema)} 
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${showSqlSchema ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}
                          >
                              {showSqlSchema ? 'Nascondi Codice' : 'Mostra Codice'}
                          </button>
                      </div>
                      
                      {showSqlSchema && (
                          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                                  <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
                                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                      Assicurati di abilitare le tabelle e le policy di sicurezza (RLS) eseguendo questo script nel database per proteggere i tuoi dati.
                                  </p>
                              </div>
                              <div className="relative group">
                                  <pre className="p-6 bg-slate-900 text-indigo-300 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-96 custom-scrollbar shadow-inner">
                                      {SQL_SCHEMA}
                                  </pre>
                                  <button 
                                    onClick={handleCopySql} 
                                    className="absolute top-4 right-4 p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all shadow-xl active:scale-95"
                                    title="Copia negli appunti"
                                  >
                                      {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* TAB: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                      <div className="mb-8">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                              <Stethoscope className="w-6 h-6 text-rose-500" />
                              Salute & Diagnostica
                          </h3>
                          <p className="text-sm text-slate-500">
                              Controlla l'integrità del grafo del progetto e risolvi rami scollegati o ID radice errati.
                          </p>
                      </div>

                      {!healthReport ? (
                           <button 
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing}
                            className="w-full py-10 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-indigo-300 transition-all group"
                          >
                              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center transition-transform group-hover:scale-110">
                                {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin text-indigo-500" /> : <Search className="w-8 h-8 text-slate-400 group-hover:text-indigo-500" />}
                              </div>
                              <span className="font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{isAnalyzing ? 'Analisi Strutturale...' : 'Avvia Check Integrità'}</span>
                          </button>
                      ) : (
                          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                              {/* Phase 1: Critical Root Issues */}
                              {(healthReport.legacyRootFound || healthReport.missingRootNode) ? (
                                  <div className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-2xl">
                                      <div className="flex items-start gap-4">
                                          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                                              <AlertTriangle className="w-6 h-6 text-rose-600" />
                                          </div>
                                          <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">FASE 1</span>
                                                  <p className="text-lg font-black text-rose-800 dark:text-rose-300">Problemi alla Radice</p>
                                              </div>
                                              <ul className="text-sm text-rose-700 dark:text-rose-400 list-disc ml-5 space-y-1 font-medium">
                                                  {healthReport.legacyRootFound && <li>ID 'root' legacy individuato. Migrazione a UUID richiesta.</li>}
                                                  {healthReport.missingRootNode && <li>Nodo di ingresso mancante o distrutto.</li>}
                                              </ul>
                                              <p className="text-xs mt-3 text-rose-600/80 dark:text-rose-400/80 italic font-bold">
                                                  Esegui questo fix prima di procedere al ripristino degli orfani.
                                              </p>
                                          </div>
                                          <button 
                                            onClick={handleFixRootIssues}
                                            disabled={isRepairing}
                                            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-black shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all active:scale-95"
                                          >
                                              {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                              Correggi Ora
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                          <Check className="w-5 h-5 text-emerald-600" />
                                      </div>
                                      <div>
                                          <p className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Radice Progetto Integra</p>
                                          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Il punto di ingresso del workflow è configurato correttamente.</p>
                                      </div>
                                  </div>
                              )}

                              {/* Phase 2: Orphaned Branches */}
                              <div>
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                          {healthReport.orphanedBranches.length > 0 && !healthReport.legacyRootFound && !healthReport.missingRootNode && (
                                              <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">FASE 2</span>
                                          )}
                                          <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">
                                              Rami Isolati / Orfani ({healthReport.orphanedBranches.length})
                                          </h4>
                                      </div>
                                      {healthReport.orphanedBranches.length > 0 && (
                                          <div className="flex gap-3">
                                              <button onClick={() => setSelectedOrphans(healthReport.orphanedBranches.map(o => o.id))} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 underline underline-offset-2">Seleziona Tutti</button>
                                              <button onClick={() => setSelectedOrphans([])} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 underline underline-offset-2">Pulisci Selezione</button>
                                          </div>
                                      )}
                                  </div>

                                  {healthReport.orphanedBranches.length === 0 ? (
                                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                                          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nessun ramo orfano. Struttura del grafo ottimale.</p>
                                      </div>
                                  ) : (
                                      <div className="space-y-2 max-h-96 overflow-y-auto pr-3 custom-scrollbar">
                                          {healthReport.orphanedBranches.map((orphan: any) => {
                                              const statusCfg = STATUS_CONFIG[orphan.status as keyof typeof STATUS_CONFIG];
                                              const progressPct = orphan.taskCount > 0 ? (orphan.completedCount / orphan.taskCount) * 100 : 0;
                                              const isSel = selectedOrphans.includes(orphan.id);
                                              return (
                                                  <div 
                                                    key={orphan.id} 
                                                    onClick={() => setSelectedOrphans(prev => isSel ? prev.filter(id => id !== orphan.id) : [...prev, orphan.id])}
                                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${isSel ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 shadow-xs'}`}
                                                  >
                                                      {isSel ? <CheckSquare className="w-6 h-6 text-indigo-600 shrink-0" /> : <Square className="w-6 h-6 text-slate-200 shrink-0" />}
                                                      <div className="min-w-0 flex-1">
                                                          <div className="flex items-center gap-2 mb-1.5">
                                                              {orphan.isLabel ? <Tag className="w-4 h-4 text-amber-500" /> : <GitBranch className="w-4 h-4 text-indigo-500" />}
                                                              <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{orphan.title || '(Senza Titolo)'}</span>
                                                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-current leading-none ${statusCfg?.color || 'text-slate-400'}`}>
                                                                  {orphan.status}
                                                              </span>
                                                          </div>
                                                          <div className="flex items-center gap-4">
                                                               <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                                                    <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-tighter leading-none mb-0.5">
                                                                        <span>Progresso Orfano</span>
                                                                        <span>{orphan.completedCount}/{orphan.taskCount}</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
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

                              {/* Orphan Actions */}
                              {selectedOrphans.length > 0 && (
                                  <div className={`flex flex-col sm:flex-row gap-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 duration-300 ${(healthReport.legacyRootFound || healthReport.missingRootNode) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                                      <div className="flex-1">
                                          <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{selectedOrphans.length} rami pronti al rientro</p>
                                          <p className="text-xs text-slate-500 font-medium">Verranno collegati automaticamente al nodo Radice del progetto.</p>
                                      </div>
                                      <div className="flex gap-2 shrink-0">
                                          <button onClick={handleRestoreSelectedOrphans} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all">
                                              <RefreshCw className="w-4 h-4" /> Ripristina
                                          </button>
                                          <button onClick={() => { if(confirm(`Eliminare definitivamente ${selectedOrphans.length} rami?`)) resolveOrphans([], selectedOrphans); setHealthReport(null); }} className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-black uppercase transition-all">
                                              Elimina
                                          </button>
                                      </div>
                                  </div>
                              )}
                              
                              <div className="flex justify-center pt-4">
                                  <button onClick={() => setHealthReport(null)} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Chiudi Report</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* TAB: MAINTENANCE */}
          {activeTab === 'maintenance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                      <div className="mb-8 text-center sm:text-left">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center justify-center sm:justify-start gap-2">
                              <Eraser className="w-6 h-6 text-amber-500" /> Manutenzione Task
                          </h3>
                          <p className="text-sm text-slate-500">Alleggerisci il progetto rimuovendo lo storico dei task completati da tempo.</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 flex flex-col md:flex-row items-center gap-10">
                          <div className="flex-1 w-full space-y-6">
                              <div className="flex justify-between items-end">
                                  <div>
                                      <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Soglia di Anzianità</label>
                                      <p className="text-xs text-slate-500">Task chiusi da almeno...</p>
                                  </div>
                                  <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full text-sm font-black">{cleanupMonths} Mesi</span>
                              </div>
                              <input type="range" min="1" max="24" value={cleanupMonths} onChange={(e) => setCleanupMonths(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                  <span>1 Mese</span>
                                  <span>2 Anni</span>
                              </div>
                          </div>
                          
                          <div className="shrink-0 flex flex-col items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-xl">
                              <div className="text-center">
                                  <span className="text-4xl font-black text-slate-800 dark:text-white leading-none">{cleanupStats}</span>
                                  <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Task Trovati</p>
                              </div>
                              <button 
                                onClick={() => setShowCleanupConfirm(true)} 
                                disabled={cleanupStats === 0} 
                                className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl shadow-xl shadow-amber-500/20 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                              >
                                  <Eraser className="w-5 h-5" /> Pulisci Database
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
                          <MessageSquare className="w-6 h-6 text-indigo-500" /> Template Solleciti
                      </h3>
                      <p className="text-sm text-slate-500 mb-6">Personalizza i messaggi predefiniti inviati tramite WhatsApp ed Email.</p>
                      
                      <div className="space-y-6">
                          <div>
                              <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Testo di Apertura</label>
                                  <span className="text-[9px] font-medium text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">Usa {`{name}`} per il nome utente</span>
                              </div>
                              <textarea 
                                value={msgOpening}
                                onChange={(e) => setMsgOpening(e.target.value)}
                                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-24"
                                placeholder="Ciao {name}, come procede..."
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Saluti di Chiusura</label>
                              <textarea 
                                value={msgClosing}
                                onChange={(e) => setMsgClosing(e.target.value)}
                                className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-24"
                                placeholder="Fammi sapere se hai bisogno di aiuto!"
                              />
                          </div>
                          <div className="pt-2">
                              <button 
                                onClick={handleSaveTemplates}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"
                              >
                                  <Save className="w-4 h-4" /> Salva Template
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Cleanup Modal */}
      {showCleanupConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6 shadow-inner">
                      <AlertTriangle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Conferma Pulizia</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
                      Stai per eliminare definitivamente <strong>{cleanupStats} task</strong> chiusi da oltre {cleanupMonths} mesi. 
                      <br/><br/>
                      <span className="font-bold text-rose-500">Questa azione non può essere annullata.</span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mt-8">
                      <button 
                        onClick={() => setShowCleanupConfirm(false)}
                        className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-200"
                      >
                          Annulla
                      </button>
                      <button 
                        onClick={handleRunCleanup}
                        disabled={isCleaning}
                        className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                      >
                          {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Elimina Ora
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsPanel;
