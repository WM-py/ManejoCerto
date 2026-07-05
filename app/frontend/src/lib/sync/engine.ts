/**
 * Motor de sincronização da fila de escrita (Fase 3).
 *
 * Fluxo:
 *  • enqueue(kind, payload) grava a intenção no outbox.
 *      – Offline: projeta otimista no cache e resolve (a tela mostra na hora).
 *      – Online : tenta na hora; erro de negócio é propagado (a tela mostra o
 *                 erro e nada fica pendente); falha de rede mantém na fila.
 *  • drain() reexecuta as intenções pendentes em ordem FIFO ao reconectar,
 *    com backoff e dead-letter, reconciliando o id temporário do lote (COMPRA)
 *    com o id real e reescrevendo as intenções seguintes que o referenciam.
 *
 * Estado (pending/failed/syncing) é exposto via subscribe/getSnapshot para o
 * badge do cabeçalho (useSync).
 */
import { db, type OutboxKind, type OutboxRecord } from '@/lib/cache/db';
import { executeIntent } from './handlers';
import { applyOptimistic, reconcileLoteTempId } from './optimistic';
import type { IntentPayloadMap } from './types';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 20_000;

// ── Estado observável ─────────────────────────────────────────────────────────
export interface SyncState {
  pending: number;
  failed: number;
  syncing: boolean;
}

let state: SyncState = { pending: 0, failed: 0, syncing: false };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot(): SyncState {
  return state;
}

async function refreshCounts(): Promise<void> {
  try {
    const total = await db.outbox.count();
    const failed = await db.outbox.where('status').equals('failed').count();
    setState({ pending: total - failed, failed });
  } catch {
    // outbox indisponível — mantém o último estado conhecido.
  }
}

// ── Classificação de erros ────────────────────────────────────────────────────
function isRetriable(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    err instanceof TypeError || // fetch abortado/sem rede
    /failed to fetch|networkerror|network error|load failed|timeout|fetch/.test(msg)
  );
}

function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Execução ──────────────────────────────────────────────────────────────────

/** Executa uma intenção no servidor e, no sucesso, remove do outbox + reconcilia. */
async function flushRecord(record: OutboxRecord): Promise<void> {
  await db.outbox.update(record.id, { status: 'syncing', attempts: record.attempts + 1 });
  const result = await executeIntent(record);
  await db.outbox.delete(record.id);

  if (result && 'tempId' in result) {
    const userId = String((record.payload as { userId?: string }).userId ?? '');
    await reconcileLoteTempId(userId, result.tempId, result.realId);
    // Reescreve intenções ainda na fila que referenciam o lote temporário.
    const queued = await db.outbox.toArray();
    for (const r of queued) {
      if ((r.payload as { loteId?: string }).loteId === result.tempId) {
        await db.outbox.update(r.id, { payload: { ...r.payload, loteId: result.realId } });
      }
    }
  }
  await refreshCounts();
}

let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, RETRY_DELAY_MS);
}

/** Drena o outbox em ordem FIFO. Seguro para chamar várias vezes (idempotente). */
export async function drain(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  draining = true;
  setState({ syncing: true });
  try {
    const records = await db.outbox.orderBy('createdAt').toArray();
    for (const record of records) {
      const fresh = await db.outbox.get(record.id);
      if (!fresh || fresh.status === 'failed') continue;
      try {
        await flushRecord(fresh);
      } catch (err) {
        if (isRetriable(err)) {
          // Rede caiu — para e tenta de novo no próximo online/backoff.
          await db.outbox.update(fresh.id, { status: 'pending', lastError: msgOf(err) });
          break;
        }
        // Erro de negócio: incrementa e vira dead-letter após o teto.
        const after = await db.outbox.get(fresh.id);
        const attempts = after?.attempts ?? fresh.attempts + 1;
        await db.outbox.update(fresh.id, {
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          lastError: msgOf(err),
        });
      }
    }
  } finally {
    draining = false;
    setState({ syncing: false });
    await refreshCounts();
    if (typeof navigator === 'undefined' || navigator.onLine) {
      if (state.pending > 0) scheduleRetry();
    }
  }
}

// ── API pública de enfileiramento ─────────────────────────────────────────────

/**
 * Enfileira uma intenção de escrita.
 *  • Offline → resolve após projetar otimista (nunca lança).
 *  • Online  → tenta na hora; propaga erro de negócio; falha de rede fica na fila.
 */
export async function enqueue<K extends OutboxKind>(
  kind: K,
  payload: IntentPayloadMap[K]
): Promise<void> {
  const record: OutboxRecord = {
    id: crypto.randomUUID(),
    kind,
    payload: payload as unknown as Record<string, unknown>,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  };
  await db.outbox.add(record);
  await refreshCounts();

  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!online) {
    await applyOptimistic(record);
    return;
  }

  try {
    await flushRecord(record);
  } catch (err) {
    if (isRetriable(err)) {
      await db.outbox.update(record.id, { status: 'pending', lastError: msgOf(err) });
      await applyOptimistic(record);
      await refreshCounts();
      scheduleRetry();
      return;
    }
    // Erro de negócio: não deixa lixo na fila e mostra o erro para o usuário.
    await db.outbox.delete(record.id);
    await refreshCounts();
    throw err;
  }
}

let started = false;

/** Inicia o motor: drena pendências e passa a drenar sempre que a rede voltar. */
export function startSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refreshCounts();
  window.addEventListener('online', () => {
    void drain();
  });
  void drain();
}
