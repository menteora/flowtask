
import { Theme } from '../types';

const KEYS = {
  THEME: 'theme',
  VIEW: 'flowtask_current_view',
  SUPABASE_CONFIG: 'supabase_config',
  OFFLINE_MODE: 'flowtask_offline_mode',
  ACTIVE_PROJECT_ID: 'flowtask_active_project_id',
  OPEN_PROJECT_IDS: 'flowtask_open_project_ids',
};

/**
 * LocalStorage viene mantenuto per configurazioni sincronizzate e 
 * per lo stato del workspace (progetti aperti/attivi).
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
  
  getOfflineMode: (): boolean => localStorage.getItem(KEYS.OFFLINE_MODE) === 'true',
  saveOfflineMode: (offline: boolean) => localStorage.setItem(KEYS.OFFLINE_MODE, String(offline)),

  getActiveProjectId: (): string | null => localStorage.getItem(KEYS.ACTIVE_PROJECT_ID),
  saveActiveProjectId: (id: string) => localStorage.setItem(KEYS.ACTIVE_PROJECT_ID, id),

  getOpenProjectIds: (): string[] => {
    try {
      const stored = localStorage.getItem(KEYS.OPEN_PROJECT_IDS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },
  saveOpenProjectIds: (ids: string[]) => {
    localStorage.setItem(KEYS.OPEN_PROJECT_IDS, JSON.stringify(ids));
  }
};
