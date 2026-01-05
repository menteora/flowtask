
import { ProjectState, SyncOperation } from '../types';

const DB_NAME = 'FlowTaskDB';
const DB_VERSION = 2; // Incrementato per nuova tabella sync_queue
const STORES = {
  PROJECTS: 'projects',
  SETTINGS: 'settings',
  SYNC_QUEUE: 'sync_queue'
};

class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async getAllProjects(): Promise<ProjectState[]> {
    const store = await this.getStore(STORES.PROJECTS, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProject(project: ProjectState): Promise<void> {
    const store = await this.getStore(STORES.PROJECTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const store = await this.getStore(STORES.PROJECTS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync Queue Methods
  async addToSyncQueue(op: SyncOperation): Promise<void> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(op);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncOperation[]> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    const store = await this.getStore(STORES.SYNC_QUEUE, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    const store = await this.getStore(STORES.SETTINGS, 'readwrite');
    store.put(value, key);
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const store = await this.getStore(STORES.SETTINGS, 'readonly');
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }
}

export const dbService = new IndexedDBService();
