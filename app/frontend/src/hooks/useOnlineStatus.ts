import { useSyncExternalStore } from 'react';

/**
 * Status de conectividade do navegador (navigator.onLine + eventos online/offline).
 *
 * Base do indicador "Conectado / Offline" no cabeçalho. Na Fase 3 (fila de sync)
 * o mesmo sinal dispara o drain do outbox ao voltar a rede.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  // SSR/prerender não tem navigator — assume online (getServerSnapshot).
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
