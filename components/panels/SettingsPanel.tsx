import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Branch } from '../../types';
import { 
  Database, Save, Download, Key, Check, Copy, Cloud, Loader2, Upload, 
  User, LogOut, X, Trash2, Eraser, AlertTriangle, Stethoscope, 
  Search, Square, CheckSquare, RefreshCw, MessageSquare, 
  Settings as SettingsIcon, ShieldCheck, Rocket, Eye, EyeOff, CheckCircle2, Code, DownloadCloud
} from 'lucide-react';

const SQL_SCHEMA = `-- SCHEMA SQL FLOWTASK AGGIORNATO

-- PROGETTI
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  root_branch_id text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PERSONE / TEAM
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  initials text,
  color text
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
  position integer default 0
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
  pinned boolean default false
);

alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

create policy "Users can all on own projects" on public.flowtask_projects for all using (auth.uid() = owner_id);
create policy "Users can all on people of own projects" on public.flowtask_people for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_people.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on branches of own projects" on public.flowtask_branches for all using (exists (select 1 from public.flowtask_projects where public.flowtask_projects.id = public.flowtask_branches.project_id and public.flowtask_projects.owner_id = auth.uid()));
create policy "Users can all on tasks of own projects" on public.flowtask_tasks for all using (exists (select 1 from public.flowtask_branches join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id where public.flowtask_branches.id = public.flowtask_tasks.branch_id and public.flowtask_projects.owner_id = auth.uid()));`;

type TabType = 'cloud' | 'diagnostics' | 'maintenance' | 'preferences';

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, setSupabaseConfig, uploadProjectToSupabase, listProjectsFromSupabase,
    downloadProjectFromSupabase, deleteProjectFromSupabase, cleanupOldTasks,
    checkProjectHealth, repairProjectStructure, resolveOrphans,
    state, session, logout, disableOfflineMode, showNotification,
    messageTemplates, updateMessageTemplates, supabaseClient
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
  const [expandedOrphanId, setExpandedOrphanId] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

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

  const copySqlToClipboard = () => {
      navigator.clipboard.writeText(SQL_SCHEMA);
      showNotification("Script SQL copiato!", 'success');
  };

  const handleCloudSave = async () => {
      if (!session) return;
      setIsSaving(true);
      try {
          await uploadProjectToSupabase();
          showNotification("Progetto salvato nel cloud!", 'success');
          handleListProjects();
      } catch (e) { 
          showNotification("Errore salvataggio cloud.", 'error');
      } finally { setIsSaving(false); }
  };

  const handleExportAllCloud = async () => {
      if (!supabaseClient || !session) return;
      setIsExportingAll(true);
      try {
          // 1. Recupera tutti i progetti dell'utente
          const { data: projects, error: pErr } = await supabaseClient
              .from('flowtask_projects')
              .select('*')
              .eq('owner_id', session.user.id);
          
          if (pErr) throw pErr;
          if (!projects || projects.length === 0) {
              showNotification("Nessun progetto trovato nel cloud.", 'error');
              return;
          }

          const projectIds = projects.map(p => p.id);

          // 2. Recupera tutto il resto in parallelo basandosi sugli ID dei progetti
          const [peopleRes, branchesRes] = await Promise.all([
              supabaseClient.from('flowtask_people').select('*').in('project_id', projectIds),
              supabaseClient.from('flowtask_branches').select('*').in('project_id', projectIds)
          ]);

          if (peopleRes.error) throw peopleRes.error;
          if (branchesRes.error) throw branchesRes.error;

          const branchIds = branchesRes.data?.map(b => b.id) || [];
          
          // 3. Recupera i task basandosi sui rami trovati
          let tasks: any[] = [];
          if (branchIds.length > 0) {
              const { data: tData, error: tErr } = await supabaseClient.from('flowtask_tasks').select('*').in('branch_id', branchIds);
              if (tErr) throw tErr;
              tasks = tData || [];
          }

          // 4. Struttura l'export
          const fullExport = {
              exportDate: new Date().toISOString(),
              account: session.user.email,
              projects: projects,
              people: peopleRes.data,
              branches: branchesRes.data,
              tasks: tasks
          };

          // 5. Trigger download
          const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' });
          const exportUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = exportUrl;
          link.download = `flowtask_full_cloud_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(exportUrl);
          
          showNotification("Backup completo scaricato!", 'success');
      } catch (e: any) {
          console.error(e);
          showNotification("Errore durante l'esportazione cloud.", 'error');
      } finally {
          setIsExportingAll(false);
      }
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
          const updatedProj = await repairProjectStructure();
          if (updatedProj) {
            const report = checkProjectHealth(updatedProj);
            setHealthReport(report);
            setSelectedOrphans(report.orphanedBranches.map(o => o.id));
          }
      } finally {
          setIsRepairing(false);
      }
  };

  const handleProcessOrphans = async (action: 'restore' | 'delete', specificId?: string) => {
      const idsToProcess = specificId ? [specificId] : selectedOrphans;
      if (idsToProcess.length === 0) return;

      if (action === 'delete' && !confirm(`Stai per eliminare DEFINITIVAMENTE ${idsToProcess.length} rami. Questa azione non è reversibile. Procedere?`)) return;

      setIsRepairing(true);
      try {
          const toFix = action === 'restore' ? idsToProcess : [];
          const toDelete = action === 'delete' ? idsToProcess : [];
          await resolveOrphans(toFix, toDelete);
          
          const updatedReport = checkProjectHealth();
          setHealthReport(updatedReport);
          setSelectedOrphans(updatedReport.orphanedBranches.map(o => o.id));

          showNotification(action === 'restore' ? "Rami ripristinati correttamente." : "Rami eliminati dal server.", 'success');
      } finally {
          setIsRepairing(false);
      }
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
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 md:w-10 md:h-10 text-indigo-600" /> 
                Impostazioni
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestione dati e salute progetto.</p>
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

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar pb-20">
          {activeTab === 'cloud' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Database</h3>
                              <p className="text-[10px] md:text-xs text-slate-500">Credenziali Supabase.</p>
                          </div>
                          <button onClick={() => setShowSql(!showSql)} className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg flex items-center gap-2">
                              <Code className="w-3.5 h-3.5" /> {showSql ? 'Nascondi SQL' : 'Mostra Schema SQL'}
                          </button>
                      </div>

                      {showSql && (
                          <div className="mb-6 animate-in zoom-in-95 duration-200">
                              <div className="flex items-center justify-between bg-slate-900 text-slate-400 px-4 py-2 rounded-t-lg border-x border-t border-slate-700">
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Script Setup Tabelle</span>
                                  <button onClick={copySqlToClipboard} className="hover:text-white transition-colors" title="Copia SQL">
                                      <Copy className="w-4 h-4" />
                                  </button>
                              </div>
                              <pre className="bg-slate-950 text-indigo-300 p-4 rounded-b-lg text-[10px] font-mono overflow-x-auto border-x border-b border-slate-700 max-h-60 custom-scrollbar">
                                  {SQL_SCHEMA}
                              </pre>
                          </div>
                      )}

                      <div className="space-y-4">
                          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Project URL" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-indigo-500 font-mono" />
                          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Anon Key" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500 font-mono" />
                          <button onClick={handleSaveConfig} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700">Salva Configurazione</button>
                      </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-indigo-500" /> Progetti Remoti</h3>
                          {session && (
                              <div className="flex gap-2">
                                  <button onClick={handleExportAllCloud} disabled={isExportingAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                                      {isExportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />} Esporta DB Cloud
                                  </button>
                                  <button onClick={handleCloudSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 shadow-md hover:bg-indigo-700">
                                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Backup Ora
                                  </button>
                              </div>
                          )}
                      </div>
                      {session ? (
                          <div className="grid grid-cols-1 gap-2">
                              {isLoadingList ? (
                                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                              ) : remoteProjects.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-4 text-center">Nessun progetto cloud trovato.</p>
                              ) : (
                                  remoteProjects.map(proj => (
                                      <div key={proj.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-50">
                                          <div className="min-w-0 pr-2">
                                              <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{proj.name}</p>
                                              <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(proj.created_at).toLocaleDateString()}</p>
                                          </div>
                                          <div className="flex gap-1">
                                              <button onClick={() => handleDownload(proj.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Scarica"><Download className="w-4 h-4" /></button>
                                              <button onClick={() => {if(confirm(`Eliminare definitivamente?`)) deleteProjectFromSupabase(proj.id).then(handleListProjects)}} className="p-2 text-slate-300 hover:text-red-500" title="Elimina"><Trash2 className="w-4 h-4" /></button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      ) : (
                          <p className="text-center p-8 text-xs text-slate-400 italic border-2 border-dashed rounded-xl">Connettiti per visualizzare i progetti remoti.</p>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'diagnostics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                      <div className="mb-6 flex justify-between items-center">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Stethoscope className="w-6 h-6 text-rose-500" /> Diagnostica Strutturale</h3>
                              <p className="text-xs text-slate-500">Riparazione radice e recupero rami isolati.</p>
                          </div>
                          {healthReport && (
                              <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500">
                                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              </button>
                          )}
                      </div>

                      {!healthReport ? (
                           <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="w-full py-12 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3">
                              {isAnalyzing ? <Loader2 className="w-8 h-8 animate-spin text-indigo-500" /> : <Search className="w-8 h-8 text-slate-400" />}
                              <span className="font-black text-slate-500 uppercase text-[10px] tracking-widest">{isAnalyzing ? 'Analisi in corso...' : 'Inizia Check Salute Progetto'}</span>
                          </button>
                      ) : (
                          <div className="space-y-6">
                              <div className={`p-4 rounded-xl border-2 transition-all ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800 animate-pulse' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800'}`}>
                                  <div className="flex flex-col sm:flex-row items-center gap-4">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                          { (healthReport.legacyRootFound || healthReport.missingRootNode) ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                      </div>
                                      <div className="flex-1 text-center sm:text-left">
                                          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'bg-rose-600' : 'bg-emerald-600'}`}>INTEGRITÀ</span>
                                              <p className={`text-sm font-black ${ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'text-rose-800 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                                                  { (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'Problema Struttura Radice' : 'Struttura Radice OK'}
                                              </p>
                                          </div>
                                          <p className="text-[10px] text-slate-500 font-bold">
                                              { (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'La radice del progetto è mancante o corrotta. Richiesto Fix.' : 'Il punto di partenza è configurato correttamente.' }
                                          </p>
                                      </div>
                                      {(healthReport.legacyRootFound || healthReport.missingRootNode) && (
                                          <button onClick={handleFixRootIssues} disabled={isRepairing} className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2">
                                              {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} FIX RADICE
                                          </button>
                                      )}
                                  </div>
                              </div>
                              <div className={ (healthReport.legacyRootFound || healthReport.missingRootNode) ? 'opacity-30 pointer-events-none grayscale' : ''}>
                                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                      <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">Rami Orfani ({healthReport.orphanedBranches.length})</h4>
                                  </div>
                                  {healthReport.orphanedBranches.length === 0 ? (
                                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                          <p className="text-xs font-black text-slate-500 uppercase">Tutti i rami sono collegati correttamente!</p>
                                      </div>
                                  ) : (
                                      <div className="space-y-2">
                                          {healthReport.orphanedBranches.map((orphan: any) => (
                                              <div key={orphan.id} className={`flex flex-col rounded-xl border transition-all ${selectedOrphans.includes(orphan.id) ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                                  <div className="flex items-center gap-3 p-3">
                                                      <button onClick={() => setSelectedOrphans(prev => prev.includes(orphan.id) ? prev.filter(id => id !== orphan.id) : [...prev, orphan.id])}>
                                                          {selectedOrphans.includes(orphan.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-200" />}
                                                      </button>
                                                      <div className="min-w-0 flex-1">
                                                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">{orphan.title || '(Senza Titolo)'}</p>
                                                          <p className="text-[10px] text-slate-400 font-bold uppercase">{orphan.status} • {orphan.taskCount} task</p>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <button onClick={() => setExpandedOrphanId(expandedOrphanId === orphan.id ? null : orphan.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                                              {expandedOrphanId === orphan.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                          </button>
                                                          <button onClick={(e) => { e.stopPropagation(); handleProcessOrphans('delete', orphan.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                              <Trash2 className="w-4 h-4" />
                                                          </button>
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                          <div className="flex gap-2 pt-4">
                                              <button onClick={() => handleProcessOrphans('restore')} disabled={selectedOrphans.length === 0 || isRepairing} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                                                  <RefreshCw className={`w-4 h-4 ${isRepairing ? 'animate-spin' : ''}`} /> Collega a Radice
                                              </button>
                                              <button onClick={() => handleProcessOrphans('delete')} disabled={selectedOrphans.length === 0 || isRepairing} className="flex-1 py-3 bg-white dark:bg-slate-800 border-2 border-rose-500 text-rose-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors disabled:opacity-50">
                                                  <Trash2 className="w-4 h-4" /> Elimina Selezionati
                                              </button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {activeTab === 'maintenance' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 text-center">
                      <Eraser className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Pulizia Task Chiusi</h3>
                      <p className="text-xs text-slate-500 mb-8">Elimina i task completati per alleggerire il progetto.</p>
                      
                      <div className="max-w-xs mx-auto space-y-6">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                              <span>Soglia Età</span>
                              <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{cleanupMonths} Mesi</span>
                          </div>
                          <input type="range" min="1" max="24" value={cleanupMonths} onChange={(e) => setCleanupMonths(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                          <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl">
                              <span className="text-2xl font-black text-slate-800 dark:text-white">{cleanupStats}</span>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Task da rimuovere</p>
                          </div>
                          <button onClick={() => setShowCleanupConfirm(true)} disabled={cleanupStats === 0} className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-30">Avvia Pulizia</button>
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
                  <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">Questa azione eliminerà DEFINITIVAMENTE {cleanupStats} task completati. Non potrai tornare indietro.</p>
                  <div className="flex gap-2 mt-8">
                      <button onClick={() => setShowCleanupConfirm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase">Annulla</button>
                      <button onClick={handleRunCleanup} disabled={isCleaning} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
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