import { db, type CacheEntry } from './db';

/**
 * Leitura cache-first com revalidação (base do offline-first, Fase 2).
 *
 *  • Online  → busca na rede, grava no cache e retorna o dado fresco.
 *              Se a rede falhar (ex.: sinal caiu no meio), cai no cache; se não
 *              houver cache, repropaga o erro.
 *  • Offline → retorna direto o último dado em cache (ou `fallback` se nunca
 *              houve cache), sem tentar a rede.
 *
 * Mantém o contrato das funções do repositório (uma única Promise por leitura),
 * então as páginas não precisam mudar a forma como consomem os dados.
 */
export async function readThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
  fallback: T
): Promise<T> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  if (online) {
    try {
      const fresh = await fetcher();
      await writeCache(key, fresh);
      return fresh;
    } catch (err) {
      const cached = await readCache<T>(key);
      if (cached !== undefined) return cached;
      throw err;
    }
  }

  const cached = await readCache<T>(key);
  return cached !== undefined ? cached : fallback;
}

/** Lê uma entrada do cache. Retorna `undefined` quando não existe/indisponível. */
export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const entry = await db.queryCache.get(key);
    return entry ? (entry.data as T) : undefined;
  } catch {
    // IndexedDB indisponível (modo privado/SSR) — degrada para "sem cache".
    return undefined;
  }
}

/** Grava (write-through) o resultado de uma leitura no cache. */
export async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    const entry: CacheEntry = { key, data, updatedAt: Date.now() };
    await db.queryCache.put(entry);
  } catch {
    // Falha ao gravar no cache nunca deve quebrar a leitura em si.
  }
}
