import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Database, Key, LogIn, Loader2, AlertCircle, Save, WifiOff } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { setSupabaseConfig, supabaseConfig, supabaseClient, loadingAuth, enableOfflineMode } = useProject();

  // Tab 1: Config (if not set or explicitly editing)
  // Tab 2: Auth (Login/Signup)

  // Determine if we have a valid config from the context (e.g. loaded from URL or localStorage)
  const hasValidConfig = !!(supabaseConfig.url && supabaseConfig.key);
  
  // State to toggle config editing mode manually
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  
  // Config Form State
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);

  // Sync local form state when context updates (e.g. when URL params are parsed on mount)
  useEffect(() => {
      setUrl(supabaseConfig.url);
      setKey(supabaseConfig.key);
  }, [supabaseConfig]);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSaveConfig = () => {
    if (url && key) {
        setSupabaseConfig(url, key);
        setIsEditingConfig(false); // Exit edit mode
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseClient) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
        let result;
        if (isLogin) {
            result = await supabaseClient.auth.signInWithPassword({ email, password });
        } else {
            result = await supabaseClient.auth.signUp({ email, password });
        }

        if (result.error) {
            setAuthError(result.error.message);
        } else if (!isLogin && !result.data.session) {
            // Signup successful but email confirmation required?
            setAuthError("Controlla la tua email per confermare la registrazione (se abilitata), oppure effettua il login.");
            setIsLogin(true);
        }
    } catch (err: any) {
        setAuthError(err.message || 'Errore sconosciuto');
    } finally {
        setAuthLoading(false);
    }
  };

  if (loadingAuth) {
      return (
          <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
      );
  }

  // SCREEN 1: CONFIGURATION
  // Show if configuration is missing OR if user explicitly wants to edit it
  if (!hasValidConfig || isEditingConfig) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
                <div className="text-center mb-8">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Benvenuto in FlowTask</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Configura il database Supabase per iniziare.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project URL</label>
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Anon Public Key</label>
                        <input 
                            type="password" 
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="eyJ..."
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    
                    <div className="flex gap-3">
                        {hasValidConfig && (
                            <button 
                                onClick={() => setIsEditingConfig(false)}
                                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                            >
                                Annulla
                            </button>
                        )}
                        <button 
                            onClick={handleSaveConfig}
                            disabled={!url || !key}
                            className={`flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <Save className="w-4 h-4" /> Salva e Continua
                        </button>
                    </div>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">OPPURE</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    <button 
                        onClick={enableOfflineMode}
                        className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <WifiOff className="w-4 h-4" /> Continua Offline
                    </button>
                </div>
            </div>
        </div>
      );
  }

  // SCREEN 2: LOGIN
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
            <div className="text-center mb-8">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Key className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {isLogin ? 'Accedi' : 'Registrati'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    {isLogin ? 'Inserisci le tue credenziali per accedere ai progetti.' : 'Crea un nuovo account.'}
                </p>
            </div>

            {authError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{authError}</span>
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required
                        minLength={6}
                    />
                </div>
                <button 
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                    {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {isLogin ? 'Accedi' : 'Registrati'}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button 
                    onClick={() => {
                        setIsLogin(!isLogin);
                        setAuthError(null);
                    }}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                    {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
                </button>
            </div>
            
            <div className="mt-6 space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                <button 
                    onClick={enableOfflineMode}
                    className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <WifiOff className="w-3 h-3" />
                    Continua Offline (Senza Cloud)
                </button>

                <button 
                    onClick={() => setIsEditingConfig(true)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 block w-full"
                >
                    Cambia Configurazione Database
                </button>
            </div>
        </div>
    </div>
  );
};

export default LoginScreen;