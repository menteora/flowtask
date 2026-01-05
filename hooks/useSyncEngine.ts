
import { useEffect, useState, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { dbService } from '../services/db';
import { supabaseService } from '../services/supabase';

export const useSyncEngine = (
  supabaseClient: SupabaseClient | null,
  session: any,
  isOfflineMode: boolean,
  showNotification: (m: string, t: 'success' | 'error') => void
) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isProcessing = false;
    const processQueue = async () => {
      if (isProcessing || isOfflineMode || !supabaseClient || !session) return;
      
      const queue = await dbService.getSyncQueue();
      if (queue.length === 0) {
        if (autoSaveStatus !== 'idle') setAutoSaveStatus('idle');
        return;
      }

      isProcessing = true;
      setAutoSaveStatus('saving');
      setPendingSyncIds(new Set(queue.map(q => q.entityId)));

      for (const op of queue) {
        try {
          let error;
          if (op.action === 'upsert') {
            const res = await supabaseService.upsertEntity(supabaseClient, op.table, op.payload);
            error = res.error;
          } else {
            const deleteTableMap: Record<string, any> = {
              flowtask_projects: supabaseService.softDeleteProject,
              flowtask_branches: supabaseService.softDeleteBranch,
              flowtask_tasks: supabaseService.softDeleteTask,
              flowtask_people: supabaseService.softDeletePerson
            };
            const res = await deleteTableMap[op.table](supabaseClient, op.entityId);
            error = res.error;
          }

          if (!error) {
            await dbService.removeFromSyncQueue(op.id!);
          } else if (error.message === 'CONCURRENCY_CONFLICT') {
            await dbService.removeFromSyncQueue(op.id!);
            showNotification("Conflitto rilevato. Dati sincronizzati dal server.", "error");
          }
        } catch (e) {
          console.error("Sync error:", e);
        }
      }
      
      setPendingSyncIds(new Set());
      setAutoSaveStatus('saved');
      isProcessing = false;
    };

    const interval = setInterval(processQueue, 5000);
    return () => clearInterval(interval);
  }, [isOfflineMode, supabaseClient, session, autoSaveStatus, showNotification]);

  return { autoSaveStatus, pendingSyncIds };
};
