import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Database, Save, Download, Key, ShieldCheck, Check, Copy, Terminal, Cloud, CloudRain, Loader2, AlertCircle, Upload, User, LogOut, LogIn, WifiOff, X, Share2, Link, Trash2 } from 'lucide-react';

const SQL_SCHEMA = `
-- CANCELLAZIONE VECCHIE TABELLE (Se esistono)
DROP TABLE IF EXISTS public.flowtask_tasks;
DROP TABLE IF EXISTS public.flowtask_branches;
DROP TABLE IF EXISTS public.flowtask_people;
DROP TABLE IF EXISTS public.flowtask_projects;

-- CREAZIONE NUOVE TABELLE CON RLS
-- Projects
create table public.flowtask_projects (
  id text primary key,
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- People
create table public.flowtask_people (
  id text primary key,
  project_id text references public.flowtask_projects(id) on delete cascade,
  name text not null,
  email text,
  initials text,
  color text
);

-- Branches
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
  parent_ids text[],
  children_ids text[],
  position integer default 0
);

-- Tasks
create table public.flowtask_tasks (
  id text primary key,
  branch_id text references public.flowtask_branches(id) on delete cascade,
  title text not null,
  assignee_id text references public.flowtask_people(id) on delete set null,
  due_date text,
  completed boolean default false,
  position integer default 0
);

-- ENABLE ROW LEVEL SECURITY
alter table public.flowtask_projects enable row level security;
alter table public.flowtask_people enable row level security;
alter table public.flowtask_branches enable row level security;
alter table public.flowtask_tasks enable row level security;

-- POLICIES (Users can only access their own projects)

-- Projects Policy
create policy "Users can all on own projects"
on public.flowtask_projects for all
using (auth.uid() = owner_id);

-- People Policy
create policy "Users can all on people of own projects"
on public.flowtask_people for all
using (
  exists (
    select 1 from public.flowtask_projects
    where public.flowtask_projects.id = public.flowtask_people.project_id
    and public.flowtask_projects.owner_id = auth.uid()
  )
);

-- Branches Policy
create policy "Users can all on branches of own projects"
on public.flowtask_branches for all
using (
  exists (
    select 1 from public.flowtask_projects
    where public.flowtask_projects.id = public.flowtask_branches.project_id
    and public.flowtask_projects.owner_id = auth.uid()
  )
);

-- Tasks Policy
create policy "Users can all on tasks of own projects"
on public.flowtask_tasks for all
using (
  exists (
    select 1 from public.flowtask_branches
    join public.flowtask_projects on public.flowtask_projects.id = public.flowtask_branches.project_id
    where public.flowtask_branches.id = public.flowtask_tasks.branch_id
    and public.flowtask_projects.owner_id = auth.uid()
  )
);
`;

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, 
    setSupabaseConfig, 
    uploadProjectToSupabase, 
    listProjectsFromSupabase,
    downloadProjectFromSupabase,
    deleteProjectFromSupabase,
    state,
    session,
    logout,
    disableOfflineMode,
    isOfflineMode
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
  
  // Confirmation state for deletion
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Notification system replacement for alerts
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setUrl(supabaseConfig.url);
      setKey(supabaseConfig.key);
  }, [supabaseConfig]);

  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const handleSaveConfig = () => {
      setSupabaseConfig(url, key);
      showNotification("Credenziali salvate nel browser.", 'success');
  };

  const handleCopySql = () => {
      navigator.clipboard.writeText(SQL_SCHEMA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateShareLink = () => {
      if (!url || !key) {
          showNotification("Configurazione mancante. Impossibile generare link.", 'error');
          return;
      }
      const config = { url, key };
      // Base64 encode for simple obfuscation (avoiding plain text in URL history)
      const encoded = btoa(JSON.stringify(config));
      const link = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
      
      navigator.clipboard.writeText(link);
      setShareLinkCopied(true);
      showNotification("Link di configurazione copiato negli appunti!", 'success');
      setTimeout(() => setShareLinkCopied(false), 3000);
  };

  const handleExportConfig = () => {
      const config = { url, key };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "flowtask_supabase_config.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleImportConfigClick = () => {
      fileInputRef.current?.click();
  };

  const handleImportConfigFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.url && json.key) {
            setUrl(json.url);
            setKey(json.key);
            setSupabaseConfig(json.url, json.key); 
            showNotification("Configurazione importata con successo!", 'success');
        } else {
            showNotification("Formato file non valido. Assicurati che contenga 'url' e 'key'.", 'error');
        }
      } catch (err) {
        showNotification("Errore durante la lettura del file JSON.", 'error');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleCloudSave = async () => {
      if (!session) {
          showNotification("Devi effettuare l'accesso per salvare sul cloud.", 'error');
          return;
      }
      setIsSaving(true);
      setSaveStatus('idle');
      try {
          await uploadProjectToSupabase();
          setSaveStatus('success');
          showNotification("Progetto salvato con successo!", 'success');
          setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (e: any) {
          console.error(e);
          setSaveStatus('error');
          showNotification("Errore durante il salvataggio: " + (e.message || e), 'error');
      } finally {
          setIsSaving(false);
      }
  };

  const handleListProjects = async () => {
      if (!session) {
          showNotification("Devi effettuare l'accesso per vedere i progetti cloud.", 'error');
          return;
      }
      setIsLoadingList(true);
      try {
          const list = await listProjectsFromSupabase();
          setRemoteProjects(list);
      } catch (e: any) {
          showNotification("Errore nel recupero progetti: " + e.message, 'error');
      } finally {
          setIsLoadingList(false);
      }
  };

  const handleDownload = async (id: string) => {
      setIsDownloading(true);
      try {
          await downloadProjectFromSupabase(id);
          showNotification("Progetto caricato con successo!", 'success');
          // setRemoteProjects([]); // Don't close list, allow downloading others
      } catch (e: any) {
          showNotification("Errore nel download: " + e.message, 'error');
      } finally {
          setIsDownloading(false);
      }
  };

  const handleConfirmDelete = async () => {
      if (!projectToDelete) return;
      
      setIsDeleting(true);
      try {
          await deleteProjectFromSupabase(projectToDelete.id);
          showNotification("Progetto eliminato dal cloud.", 'success');
          // Refresh list
          setRemoteProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      } catch (e: any) {
          showNotification("Errore durante l'eliminazione: " + e.message, 'error');
      } finally {
          setIsDeleting(false);
          setProjectToDelete(null);
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24 md:pb-8 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-md px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
            {notification.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="font-medium text-sm flex-1">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/20 rounded-full ml-2">
                <X className="w-4 h-4" />
            </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Eliminare "{projectToDelete.name}"?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Questa azione cancellerà definitivamente il progetto dal database remoto.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setProjectToDelete(null)}
                            disabled={isDeleting}
                            className="flex-1 py-2 text-sm font-medium bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                        >
                            Annulla
                        </button>
                        <button 
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="flex-1 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Elimina
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportConfigFile} 
        accept=".json" 
        className="hidden" 
      />

      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-0">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Database className="w-8 h-8 text-indigo-600" />
                Configurazione
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
                Gestione connessione e sincronizzazione.
            </p>
        </div>
        
        {session ? (
            <div className="flex items-center justify-between md:justify-start gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                        <div className="font-bold text-slate-800 dark:text-white">Logged In</div>
                        <div className="text-slate-500 dark:text-slate-400 max-w-[150px] md:max-w-[120px] truncate" title={session.user.email}>{session.user.email}</div>
                    </div>
                </div>
                <button 
                    onClick={logout}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-red-500 transition-colors"
                    title="Logout"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                 <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                     <WifiOff className="w-3 h-3" /> Offline Mode
                 </div>
                 <button 
                    onClick={disableOfflineMode}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                 >
                     <LogIn className="w-4 h-4" /> Connetti Account
                 </button>
            </div>
        )}
      </div>

      <div className="grid gap-6 md:gap-8">
          
          {/* Credentials Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Key className="w-5 h-5 text-indigo-500" />
                      Credenziali API
                  </h3>
                  <button 
                    onClick={handleGenerateShareLink}
                    disabled={!url || !key}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50 self-start sm:self-auto"
                  >
                      {shareLinkCopied ? <Check className="w-3 h-3" /> : <Link className="w-3 h-3" />}
                      {shareLinkCopied ? 'Link Copiato' : 'Condividi Configurazione'}
                  </button>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project URL</label>
                      <input 
                        type="text" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://your-project.supabase.co"
                        className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anon Public Key</label>
                      <input 
                        type="password" 
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="eyJ..."
                        className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    <button 
                        onClick={handleSaveConfig}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <Save className="w-4 h-4" /> Aggiorna
                    </button>
                    <div className="flex-1 hidden sm:block"></div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportConfig}
                            disabled={!url || !key}
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                            title="Esporta Configurazione"
                        >
                            <Download className="w-4 h-4" /> Esporta
                        </button>
                        <button 
                            onClick={handleImportConfigClick}
                            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 text-sm"
                            title="Importa Configurazione"
                        >
                            <Upload className="w-4 h-4" /> Importa
                        </button>
                    </div>
                  </div>
              </div>
          </div>

          {/* Sync Actions */}
          <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 ${!session ? 'opacity-75' : ''}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-blue-500" />
                      Sincronizzazione
                  </h3>
                  {!session && (
                      <span className="text-xs font-bold text-amber-500 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                          Richiede Login
                      </span>
                  )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Upload */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <CloudRain className="w-4 h-4" /> Salva Corrente
                      </h4>
                      <p className="text-xs md:text-sm text-slate-500 mb-4">
                          Salva <strong>"{state.name}"</strong> su Supabase. Sovrascrive i dati esistenti.
                      </p>
                      <button 
                        onClick={handleCloudSave}
                        disabled={!session || isSaving}
                        className={`w-full py-2.5 rounded-md flex items-center justify-center gap-2 font-medium transition-colors text-sm ${saveStatus === 'success' ? 'bg-green-600 text-white' : saveStatus === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                      >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                           saveStatus === 'success' ? <Check className="w-4 h-4" /> : 
                           saveStatus === 'error' ? <AlertCircle className="w-4 h-4" /> :
                           <Save className="w-4 h-4" />}
                          {isSaving ? 'Salvataggio...' : saveStatus === 'success' ? 'Salvato!' : 'Salva su Cloud'}
                      </button>
                  </div>

                  {/* Download */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-slate-800 dark:text-slate-200">
                          <Download className="w-4 h-4" /> Carica da Cloud
                      </h4>
                      <p className="text-xs md:text-sm text-slate-500 mb-4">
                          Scarica un progetto dal database.
                      </p>
                      
                      {remoteProjects.length === 0 ? (
                          <button 
                            onClick={handleListProjects}
                            disabled={!session || isLoadingList}
                            className="w-full py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                              {isLoadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                              Lista Progetti
                          </button>
                      ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto">
                               {remoteProjects.map(p => (
                                   <div key={p.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 group">
                                       <span className="text-sm font-medium truncate flex-1 pr-2">{p.name}</span>
                                       
                                       <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                onClick={() => handleDownload(p.id)}
                                                disabled={isDownloading}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                                title="Scarica"
                                            >
                                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                            </button>
                                            <button 
                                                onClick={() => setProjectToDelete(p)}
                                                disabled={isDownloading}
                                                className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded md:opacity-0 md:group-hover:opacity-100 transition-all"
                                                title="Elimina dal Cloud"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                       </div>
                                   </div>
                               ))}
                               <button onClick={() => setRemoteProjects([])} className="text-xs text-slate-400 hover:underline w-full text-center mt-2 py-1">Chiudi lista</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Setup Instructions */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  Configurazione Database (SQL)
              </h3>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Copia ed esegui questo script SQL nel tuo progetto Supabase per creare le tabelle.
              </p>
              
              <div className="relative group">
                  <div className="absolute top-2 right-2">
                      <button 
                        onClick={handleCopySql}
                        className="p-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs"
                      >
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Copiato' : 'Copia SQL'}
                      </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-[10px] md:text-xs overflow-x-auto font-mono h-48 md:h-64 border border-slate-700">
                      <code>{SQL_SCHEMA}</code>
                  </pre>
              </div>
          </div>
      </div>
    </div>
  );
};

export default SettingsPanel;