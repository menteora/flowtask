
import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { 
  Database, Download, Key, Cloud, Loader2, User, LogOut, Code, DownloadCloud, Wifi, WifiOff,
  Settings as SettingsIcon, MessageSquare, Copy, Upload, Trash2
} from 'lucide-react';

const SQL_SCHEMA = `-- SCHEMA SQL FLOWTASK AGGIORNATO
-- Eseguire nell'SQL Editor di Supabase
... (schema omesso per brevità, lo stesso dei file precedenti) ...`;

type TabType = 'cloud' | 'preferences';

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, setSupabaseConfig, uploadProjectToSupabase, listProjectsFromSupabase,
    downloadProjectFromSupabase, deleteProjectFromSupabase,
    state, session, logout, disableOfflineMode, enableOfflineMode, showNotification,
    isOfflineMode
  } = useProject();

  // Using TaskContext for preferences
  const { messageTemplates, updateMessageTemplates } = useTask();

  const [activeTab, setActiveTab] = useState<TabType>('cloud');
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [msgOpening, setMsgOpening] = useState(messageTemplates.opening);
  const [msgClosing, setMsgClosing] = useState(messageTemplates.closing);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
      if (session && activeTab === 'cloud') {
          handleListProjects();
      }
  }, [session, activeTab]);

  const handleSaveConfig = () => {
      setSupabaseConfig(url, key);
      showNotification("Credenziali salvate.", 'success');
  };

  const handleSaveTemplates = () => {
      updateMessageTemplates({ opening: msgOpening, closing: msgClosing });
      showNotification("Template aggiornati.", 'success');
  };

  const handleListProjects = async () => {
      if (!session) return;
      setIsLoadingList(true);
      try {
          const list = await listProjectsFromSupabase();
          setRemoteProjects(list);
      } finally { setIsLoadingList(false); }
  };

  const handleUpload = async () => {
      setIsUploading(true);
      try {
          await uploadProjectToSupabase();
          showNotification("Progetto caricato sul cloud!", 'success');
          handleListProjects();
      } catch (e) {
          showNotification("Errore durante il caricamento.", 'error');
      } finally { setIsUploading(false); }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-hidden relative">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 text-indigo-600" /> Impostazioni
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Configura la persistenza dei tuoi dati.</p>
        </div>
        
        <div className="flex gap-2">
            {isOfflineMode ? (
                <button onClick={disableOfflineMode} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2">
                    <Wifi className="w-4 h-4" /> Passa a Cloud
                </button>
            ) : (
                <button onClick={enableOfflineMode} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2">
                    <WifiOff className="w-4 h-4" /> Lavora in Locale
                </button>
            )}
            {session && (
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 dark:border-slate-800"><LogOut className="w-4 h-4" /></button>
            )}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => setActiveTab('cloud')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'cloud' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Cloud & Database</button>
          <button onClick={() => setActiveTab('preferences')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'preferences' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Preferenze</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
          {activeTab === 'cloud' && (
              <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-bold flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Configurazione Supabase</h3>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${isOfflineMode ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isOfflineMode ? 'Offline (Locale)' : 'Online (Cloud)'}
                          </div>
                      </div>
                      <div className="space-y-4">
                          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Supabase Project URL" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono" />
                          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono" />
                          <button onClick={handleSaveConfig} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Aggiorna Credenziali</button>
                      </div>
                  </div>

                  {!isOfflineMode && session && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                          <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold flex items-center gap-2"><DownloadCloud className="w-5 h-5 text-indigo-500" /> Gestione Cloud</h3>
                              <button onClick={handleUpload} disabled={isUploading} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50">
                                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica Progetto Corrente
                              </button>
                          </div>
                          
                          <div className="space-y-2">
                              {isLoadingList ? (
                                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                              ) : remoteProjects.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic text-center py-4">Nessun progetto trovato nel cloud.</p>
                              ) : (
                                  remoteProjects.map(proj => (
                                      <div key={proj.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50">
                                          <div>
                                              <p className="text-xs font-black text-slate-700 dark:text-slate-200">{proj.name}</p>
                                              <p className="text-[9px] text-slate-400 uppercase font-bold">{new Date(proj.created_at).toLocaleDateString()}</p>
                                          </div>
                                          <div className="flex gap-1">
                                              <button onClick={() => downloadProjectFromSupabase(proj.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Scarica"><Download className="w-4 h-4" /></button>
                                              <button onClick={() => deleteProjectFromSupabase(proj.id).then(handleListProjects)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'preferences' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-500" /> Template Solleciti</h3>
                  <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Apertura</label>
                      <textarea value={msgOpening} onChange={(e) => setMsgOpening(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs min-h-[80px]" />
                  </div>
                  <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Chiusura</label>
                      <textarea value={msgClosing} onChange={(e) => setMsgClosing(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs min-h-[80px]" />
                  </div>
                  <button onClick={handleSaveTemplates} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg">Salva Template</button>
              </div>
          )}
      </div>
    </div>
  );
};

export default SettingsPanel;
