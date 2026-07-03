import Dexie, { type Table } from 'dexie';

/**
 * Cache local (IndexedDB) do Manejo Certo — base do offline-first.
 *
 * Fase 2: um cache genérico de resultados de leitura (`queryCache`), keyed por
 * uma string de query. O repositório (`loteRepo`) escreve nele a cada leitura
 * bem-sucedida e o serve quando não há rede.
 *
 * Fase 3 (fila de sync) adicionará um store `outbox` neste mesmo DB — por isso
 * a versão do schema já é isolada aqui.
 */
export interface CacheEntry {
  /** Chave da query (ex.: "lotes:<userId>:ativo"). */
  key: string;
  /** Resultado serializável da leitura (array, objeto ou null). */
  data: unknown;
  /** Epoch ms da última gravação — permite futura expiração/telemetria. */
  updatedAt: number;
}

/** Tipos de intenção de escrita enfileirados (fluxo de curral). */
export type OutboxKind = 'COMPRA' | 'VENDA' | 'PESAGEM_LOTE' | 'BAIXA' | 'EXCLUIR_LOTE';

export type OutboxStatus = 'pending' | 'syncing' | 'failed';

/** Uma escrita pendente de sincronização (Fase 3). */
export interface OutboxRecord {
  /** UUID local da intenção. */
  id: string;
  kind: OutboxKind;
  /** Dados da operação — inclui user_id e (para COMPRA) um lote_id temporário. */
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  createdAt: number;
  /** Última mensagem de erro (dead-letter). */
  lastError?: string;
}

class ManejoCertoDB extends Dexie {
  queryCache!: Table<CacheEntry, string>;
  outbox!: Table<OutboxRecord, string>;

  constructor() {
    super('manejo-certo');
    this.version(1).stores({
      queryCache: 'key, updatedAt',
    });
    // v2: fila de escrita (outbox). FIFO por createdAt; filtro por status.
    this.version(2).stores({
      queryCache: 'key, updatedAt',
      outbox: 'id, createdAt, status',
    });
  }
}

export const db = new ManejoCertoDB();
