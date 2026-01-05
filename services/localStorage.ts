
import { Theme } from '../types';

const KEYS = {
  THEME: 'theme',
  VIEW: 'flowtask_current_view',
  SUPABASE_CONFIG: 'supabase_config',
  OFFLINE_MODE: 'flowtask_offline_mode',
};

/**
 * LocalStorage viene mantenuto solo per configurazioni che devono essere
 * lette in modo sincrono all'avvio dell'applicazione (es. tema).
 */
export const localStorageService = {
  getTheme: (): Theme => (localStorage.getItem(KEYS.THEME) as Theme) || 'light',
  saveTheme: (theme: Theme) => localStorage.setItem(KEYS.THEME, theme),
  
  getView: (fallback: string): string => localStorage.getItem(KEYS.VIEW) || fallback,
  saveView: (view: string) => localStorage.setItem(KEYS.VIEW, view),

  getSupabaseConfig: () => {
    const stored = localStorage.getItem(KEYS.SUPABASE_CONFIG);
    if (stored) {
      try { return JSON.parse(stored); } catch (e) {}
    }
    return { url: '', key: '' };
  },
  saveSupabaseConfig: (config: { url: string; key: string }) => {
    localStorage.setItem(KEYS.SUPABASE_CONFIG, JSON.stringify(config));
  },
  
  // Aggiunto supporto per offline mode
  getOfflineMode: (): boolean => localStorage.getItem(KEYS.OFFLINE_MODE) === 'true',
  saveOfflineMode: (offline: boolean) => localStorage.setItem(KEYS.OFFLINE_MODE, String(offline)),
};
