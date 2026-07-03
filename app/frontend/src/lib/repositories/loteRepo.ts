/**
 * Camada de repositório do Lote (Sprint 0).
 *
 * Único ponto de acesso a dados de lote/pesagem/rebanho. As páginas NÃO falam
 * direto com o supabase — falam com o repositório. Isso permite, no Sprint 1,
 * trocar a implementação por um store offline (IndexedDB + outbox) sem mexer
 * na UI.
 *
 * Convenção:
 *   • Leituras retornam o dado (ou [] / null); erro vira exceção.
 *   • Escritas retornam void/id; erro vira exceção.
 */
import { supabase, TABLES, VIEWS, RPC } from '@/lib/supabase';
import { readThrough } from '@/lib/cache/readThrough';
import type {
  Lote,
  Pasto,
  Transacao,
  CompraVenda,
  Baixa,
  PesagemEvento,
  GmdLoteEvento,
  LoteRebanho,
} from '@/lib/types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Chave de cache estável para leituras de conjunto (independe da ordem dos ids). */
function loteIdsKey(loteIds: string[]): string {
  return [...loteIds].sort().join(',');
}

// ── Leituras (cache-first: servem do IndexedDB quando offline) ────────────────

export async function getLote(id: string): Promise<Lote | null> {
  return readThrough<Lote | null>(
    `lote:${id}`,
    async () => {
      const { data, error } = await supabase.from(TABLES.lotes).select('*').eq('id', id).single();
      if (error) {
        // single() sem linha retorna PGRST116 — tratamos como "não encontrado"
        if ((error as { code?: string }).code === 'PGRST116') return null;
        throw new Error(error.message);
      }
      return data as Lote;
    },
    null
  );
}

/** Lista os lotes do usuário por status (ativo/encerrado). */
export async function listLotesByStatus(
  userId: string,
  status: 'ativo' | 'encerrado'
): Promise<Lote[]> {
  return readThrough<Lote[]>(
    `lotes:${userId}:${status}`,
    async () =>
      unwrap<Lote[]>(
        await supabase
          .from(TABLES.lotes)
          .select('*')
          .eq('user_id', userId)
          .eq('status', status)
          .order('data_entrada', { ascending: false })
      ) ?? [],
    []
  );
}

/** Lista os pastos do usuário. */
export async function listPastos(userId: string): Promise<Pasto[]> {
  return readThrough<Pasto[]>(
    `pastos:${userId}`,
    async () =>
      unwrap<Pasto[]>(
        await supabase
          .from(TABLES.pastos)
          .select('*')
          .eq('user_id', userId)
          .order('nome_pasto')
      ) ?? [],
    []
  );
}

export async function getRebanho(loteId: string): Promise<LoteRebanho | null> {
  return readThrough<LoteRebanho | null>(
    `rebanho:${loteId}`,
    async () => {
      const { data, error } = await supabase
        .from(VIEWS.lote_rebanho)
        .select('*')
        .eq('lote_id', loteId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as LoteRebanho) ?? null;
    },
    null
  );
}

export async function listEventosPesagem(userId: string, loteId: string): Promise<PesagemEvento[]> {
  return readThrough<PesagemEvento[]>(
    `pesagem_eventos:${userId}:${loteId}`,
    async () =>
      unwrap<PesagemEvento[]>(
        await supabase
          .from(TABLES.pesagem_eventos)
          .select('*')
          .eq('user_id', userId)
          .eq('lote_id', loteId)
          .is('deleted_at', null)
          .order('data_pesagem', { ascending: true })
      ) ?? [],
    []
  );
}

/** Batch: eventos de pesagem de vários lotes (usado no Dashboard). */
export async function listEventosPesagemByLotes(
  userId: string,
  loteIds: string[]
): Promise<PesagemEvento[]> {
  if (loteIds.length === 0) return [];
  return readThrough<PesagemEvento[]>(
    `pesagem_eventos_multi:${userId}:${loteIdsKey(loteIds)}`,
    async () =>
      unwrap<PesagemEvento[]>(
        await supabase
          .from(TABLES.pesagem_eventos)
          .select('*')
          .eq('user_id', userId)
          .in('lote_id', loteIds)
          .is('deleted_at', null)
          .order('data_pesagem', { ascending: true })
      ) ?? [],
    []
  );
}

/** Batch: rebanho (contagens) de vários lotes. */
export async function getRebanhoByLotes(loteIds: string[]): Promise<LoteRebanho[]> {
  if (loteIds.length === 0) return [];
  return readThrough<LoteRebanho[]>(
    `rebanho_multi:${loteIdsKey(loteIds)}`,
    async () =>
      unwrap<LoteRebanho[]>(
        await supabase.from(VIEWS.lote_rebanho).select('*').in('lote_id', loteIds)
      ) ?? [],
    []
  );
}

export async function listGmdLoteEvento(loteId: string): Promise<GmdLoteEvento[]> {
  return readThrough<GmdLoteEvento[]>(
    `gmd_lote_evento:${loteId}`,
    async () =>
      unwrap<GmdLoteEvento[]>(
        await supabase
          .from(VIEWS.gmd_lote_evento)
          .select('*')
          .eq('lote_id', loteId)
          .order('data_pesagem', { ascending: true })
      ) ?? [],
    []
  );
}

export async function listTransacoesByLote(userId: string, loteId: string): Promise<Transacao[]> {
  return readThrough<Transacao[]>(
    `transacoes_lote:${userId}:${loteId}`,
    async () =>
      unwrap<Transacao[]>(
        await supabase
          .from(TABLES.transacoes)
          .select('*')
          .eq('user_id', userId)
          .eq('lote_id', loteId)
          .order('data', { ascending: false })
      ) ?? [],
    []
  );
}

export async function listComprasVendasByLote(loteId: string): Promise<CompraVenda[]> {
  return readThrough<CompraVenda[]>(
    `compras_vendas_lote:${loteId}`,
    async () =>
      unwrap<CompraVenda[]>(
        await supabase
          .from(TABLES.compras_vendas)
          .select('*')
          .eq('lote_id', loteId)
          .order('created_at', { ascending: false })
      ) ?? [],
    []
  );
}

export async function listBaixasByLote(userId: string, loteId: string): Promise<Baixa[]> {
  return readThrough<Baixa[]>(
    `baixas_lote:${userId}:${loteId}`,
    async () =>
      unwrap<Baixa[]>(
        await supabase
          .from(TABLES.baixas)
          .select('*')
          .eq('user_id', userId)
          .eq('lote_id', loteId)
          .order('data_baixa', { ascending: false })
      ) ?? [],
    []
  );
}

// ── Escritas (via RPC — garantem integridade + snapshot no servidor) ──────────

/**
 * Cria o lote e gera N animais automaticamente. Retorna o lote_id.
 * `pesoEntradaKg` é o PESO MÉDIO POR CABEÇA (mesma semântica de lotes.peso_entrada_kg).
 */
export async function criarLoteComAnimais(input: {
  nomeLote: string;
  qtdCabecas: number;
  pesoEntradaKg: number;
  dataEntrada: string;
  pastoId?: string | null;
  sexo?: string;
  categoria?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc(RPC.criarLoteComAnimais, {
    p_nome_lote: input.nomeLote,
    p_qtd_cabecas: input.qtdCabecas,
    p_peso_entrada_kg: input.pesoEntradaKg,
    p_data_entrada: input.dataEntrada,
    p_pasto_id: input.pastoId ?? null,
    p_sexo: input.sexo ?? 'Misto',
    p_categoria: input.categoria ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Registra pesagem de lote total. O snapshot de cabeças é calculado no servidor. */
export async function registrarPesagemLoteTotal(input: {
  loteId: string;
  data: string;
  pesoTotalKg: number;
  observacao?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc(RPC.registrarPesagemLoteTotal, {
    p_lote_id: input.loteId,
    p_data: input.data,
    p_peso_total_kg: input.pesoTotalKg,
    p_observacao: input.observacao ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Registra baixa (mortalidade): fecha N vínculos e mantém os contadores coerentes. */
export async function registrarBaixa(input: {
  loteId: string;
  qtd: number;
  data: string;
  motivo?: string;
}): Promise<void> {
  const { error } = await supabase.rpc(RPC.registrarBaixa, {
    p_lote_id: input.loteId,
    p_qtd: input.qtd,
    p_data: input.data,
    p_motivo: input.motivo ?? 'Mortalidade',
  });
  if (error) throw new Error(error.message);
}

/**
 * Registra a saída por venda: fecha N vínculos (motivo='venda'), marca os animais
 * como 'vendido' e incrementa o cache qtd_cabecas_vendidas.
 * A transação financeira + compras_vendas são gravadas separadamente pela UI.
 */
export async function registrarVendaSaida(input: {
  loteId: string;
  qtd: number;
  data: string;
}): Promise<void> {
  const { error } = await supabase.rpc(RPC.registrarVendaSaida, {
    p_lote_id: input.loteId,
    p_qtd: input.qtd,
    p_data: input.data,
  });
  if (error) throw new Error(error.message);
}

/** Exclui o lote em cascata (novo modelo + legado) de forma transacional no servidor. */
export async function excluirLote(loteId: string): Promise<void> {
  const { error } = await supabase.rpc(RPC.excluirLote, { p_lote_id: loteId });
  if (error) throw new Error(error.message);
}

/** Soft-delete de um evento de pesagem (sync-friendly: marca deleted_at). */
export async function excluirEventoPesagem(userId: string, eventoId: string): Promise<void> {
  const { data, error } = await supabase
    .from(TABLES.pesagem_eventos)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', eventoId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('O evento de pesagem não foi removido pelo banco. Verifique as permissões.');
  }
}
