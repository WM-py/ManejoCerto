import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, type SyncState } from '@/lib/sync/engine';

/**
 * Estado da fila de sincronização para a UI (badge do cabeçalho):
 * quantas escritas estão pendentes, quantas falharam e se está sincronizando.
 */
export function useSync(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
