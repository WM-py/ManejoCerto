/**
 * Projeção otimista no cache local (caminho offline).
 *
 * Ao registrar algo sem rede, aplicamos o efeito nas CHAVES PRIMÁRIAS do cache
 * (as que as telas de curral leem) para o usuário ver o resultado na hora. Ao
 * reconectar, o refetch real sobrescreve o cache e corrige qualquer aproximação.
 *
 * Regras: nunca lançar exceção (é best-effort) e só tocar chaves cujo formato
 * conhecemos. Chaves agregadas (multi-lote do Dashboard) não são corrigidas aqui
 * — elas se acertam no próximo refetch online.
 */
import { readCache, writeCache } from '@/lib/cache/readThrough';
import type { OutboxRecord } from '@/lib/cache/db';
import type { Lote, LoteRebanho, PesagemEvento } from '@/lib/types';
import type {
  CompraPayload,
  VendaPayload,
  PesagemLotePayload,
  BaixaPayload,
  ExcluirLotePayload,
} from './types';

const lotesKey = (userId: string, status: 'ativo' | 'encerrado') => `lotes:${userId}:${status}`;
const loteKey = (id: string) => `lote:${id}`;
const rebanhoKey = (loteId: string) => `rebanho:${loteId}`;
const eventosKey = (userId: string, loteId: string) => `pesagem_eventos:${userId}:${loteId}`;

async function patchRebanho(
  loteId: string,
  patch: (r: LoteRebanho) => LoteRebanho
): Promise<void> {
  const current =
    (await readCache<LoteRebanho | null>(rebanhoKey(loteId))) ?? {
      lote_id: loteId,
      cabecas_vivas: 0,
      cabecas_total: 0,
      cabecas_vendidas: 0,
      cabecas_baixa: 0,
    };
  await writeCache(rebanhoKey(loteId), patch(current));
}

async function compra(p: CompraPayload): Promise<void> {
  const now = new Date().toISOString();
  const tempLote: Lote = {
    id: p.tempLoteId,
    user_id: p.userId,
    nome_lote: p.nomeLote,
    qtd_cabecas: p.qtdCabecas,
    qtd_cabecas_vendidas: 0,
    status: 'ativo',
    data_entrada: p.dataEntrada,
    peso_entrada_kg: p.pesoEntradaKg,
    pasto_id: p.pastoId,
    sexo: p.sexo as Lote['sexo'],
    categoria: p.categoria ?? undefined,
    created_at: now,
  };
  const ativos = (await readCache<Lote[]>(lotesKey(p.userId, 'ativo'))) ?? [];
  await writeCache(lotesKey(p.userId, 'ativo'), [tempLote, ...ativos]);
  await writeCache(loteKey(p.tempLoteId), tempLote);
  await writeCache(rebanhoKey(p.tempLoteId), {
    lote_id: p.tempLoteId,
    cabecas_vivas: p.qtdCabecas,
    cabecas_total: p.qtdCabecas,
    cabecas_vendidas: 0,
    cabecas_baixa: 0,
  } satisfies LoteRebanho);
}

async function venda(p: VendaPayload): Promise<void> {
  await patchRebanho(p.loteId, (r) => ({
    ...r,
    cabecas_vivas: Math.max(0, r.cabecas_vivas - p.qtdCabecas),
    cabecas_vendidas: r.cabecas_vendidas + p.qtdCabecas,
  }));
  // Reflete a venda também na lista de lotes ativos (seletor da Compra/Venda).
  const ativos = await readCache<Lote[]>(lotesKey(p.userId, 'ativo'));
  if (ativos) {
    await writeCache(
      lotesKey(p.userId, 'ativo'),
      ativos.map((l) =>
        l.id === p.loteId
          ? { ...l, qtd_cabecas_vendidas: l.qtd_cabecas_vendidas + p.qtdCabecas }
          : l
      )
    );
  }
}

async function pesagemLote(p: PesagemLotePayload): Promise<void> {
  const rebanho = await readCache<LoteRebanho | null>(rebanhoKey(p.loteId));
  const now = new Date().toISOString();
  const evento: PesagemEvento = {
    id: `temp-${crypto.randomUUID()}`,
    user_id: p.userId,
    lote_id: p.loteId,
    data_pesagem: p.data,
    tipo: 'lote_total',
    peso_total_kg: p.pesoTotalKg,
    qtd_cabecas_pesadas: rebanho?.cabecas_vivas ?? null,
    observacao: p.observacao,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const eventos = (await readCache<PesagemEvento[]>(eventosKey(p.userId, p.loteId))) ?? [];
  await writeCache(eventosKey(p.userId, p.loteId), [...eventos, evento]);
}

async function baixa(p: BaixaPayload): Promise<void> {
  await patchRebanho(p.loteId, (r) => ({
    ...r,
    cabecas_vivas: Math.max(0, r.cabecas_vivas - p.qtd),
    cabecas_baixa: r.cabecas_baixa + p.qtd,
  }));
}

async function excluirLote(p: ExcluirLotePayload): Promise<void> {
  for (const status of ['ativo', 'encerrado'] as const) {
    const list = await readCache<Lote[]>(lotesKey(p.userId, status));
    if (list) {
      await writeCache(lotesKey(p.userId, status), list.filter((l) => l.id !== p.loteId));
    }
  }
}

/** Aplica a projeção otimista de uma intenção recém-enfileirada. Nunca lança. */
export async function applyOptimistic(record: OutboxRecord): Promise<void> {
  try {
    switch (record.kind) {
      case 'COMPRA':
        return await compra(record.payload as unknown as CompraPayload);
      case 'VENDA':
        return await venda(record.payload as unknown as VendaPayload);
      case 'PESAGEM_LOTE':
        return await pesagemLote(record.payload as unknown as PesagemLotePayload);
      case 'BAIXA':
        return await baixa(record.payload as unknown as BaixaPayload);
      case 'EXCLUIR_LOTE':
        return await excluirLote(record.payload as unknown as ExcluirLotePayload);
    }
  } catch {
    // Projeção otimista é best-effort — o refetch online corrige.
  }
}

/**
 * Reconcilia o id temporário de um lote (criado offline) com o id real após a
 * COMPRA sincronizar: reescreve as chaves de cache que usavam o id temporário.
 */
export async function reconcileLoteTempId(
  userId: string,
  tempId: string,
  realId: string
): Promise<void> {
  try {
    // lote:<temp> → lote:<real>
    const lote = await readCache<Lote | null>(loteKey(tempId));
    if (lote) {
      await writeCache(loteKey(realId), { ...lote, id: realId });
    }
    // rebanho:<temp> → rebanho:<real>
    const rebanho = await readCache<LoteRebanho | null>(rebanhoKey(tempId));
    if (rebanho) {
      await writeCache(rebanhoKey(realId), { ...rebanho, lote_id: realId });
    }
    // Atualiza o id dentro da lista de ativos.
    const ativos = await readCache<Lote[]>(lotesKey(userId, 'ativo'));
    if (ativos) {
      await writeCache(
        lotesKey(userId, 'ativo'),
        ativos.map((l) => (l.id === tempId ? { ...l, id: realId } : l))
      );
    }
  } catch {
    // Best-effort.
  }
}
