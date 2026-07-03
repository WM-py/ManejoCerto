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

class ManejoCertoDB extends Dexie {
  queryCache!: Table<CacheEntry, string>;

  constructor() {
    super('manejo-certo');
    this.version(1).stores({
      queryCache: 'key, updatedAt',
    });
  }
}

export const db = new ManejoCertoDB();
