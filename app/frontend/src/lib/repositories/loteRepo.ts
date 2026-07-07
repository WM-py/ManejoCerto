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
import { supabase, TABLES, VIEWS } from '@/lib/supabase';
import { readThrough } from '@/lib/cache/readThrough';
import { enqueue } from '@/lib/sync/engine';
import type {
  Lote,
  Pasto,
  Transacao,
  CompraVenda,
  Baixa,
  PesagemEvento,
  GmdLoteEvento,
  GmdAnimal,
  GmdLoteIndividual,
  AnimalVinculo,
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

/** Animais ativos do lote (com identidade), para etiquetagem e pesagem individual. */
export async function listAnimaisDoLote(loteId: string): Promise<AnimalVinculo[]> {
  return readThrough<AnimalVinculo[]>(
    `animais_lote:${loteId}`,
    async () =>
      unwrap<AnimalVinculo[]>(
        await supabase
          .from(TABLES.lote_animais)
          .select(
            'animal_id, data_entrada, peso_entrada_kg, animais(id, brinco_visual, brinco_rfid, sexo)'
          )
          .eq('lote_id', loteId)
          .is('data_saida', null)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
      ) ?? [],
    []
  );
}

/** Última pesagem individual de um animal (contexto do "peso anterior" no curral). */
export async function getUltimoPesoAnimal(
  animalId: string
): Promise<{ peso: number; data: string } | null> {
  const { data, error } = await supabase
    .from(TABLES.pesagens_animal)
    .select('peso_kg, data_pesagem')
    .eq('animal_id', animalId)
    .is('deleted_at', null)
    .order('data_pesagem', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { peso: Number(data.peso_kg), data: data.data_pesagem } : null;
}

/** GMD por animal do lote (view v_gmd_animal) — alimenta os badges por brinco. */
export async function listGmdAnimalByLote(loteId: string): Promise<GmdAnimal[]> {
  return readThrough<GmdAnimal[]>(
    `gmd_animal_lote:${loteId}`,
    async () =>
      unwrap<GmdAnimal[]>(
        await supabase
          .from(VIEWS.gmd_animal)
          .select('*')
          .eq('lote_id', loteId)
          .order('data_pesagem', { ascending: true })
      ) ?? [],
    []
  );
}

/** GMD médio do lote via pesagens individuais (view v_gmd_lote_individual). */
export async function listGmdLoteIndividual(loteId: string): Promise<GmdLoteIndividual[]> {
  return readThrough<GmdLoteIndividual[]>(
    `gmd_lote_individual:${loteId}`,
    async () =>
      unwrap<GmdLoteIndividual[]>(
        await supabase
          .from(VIEWS.gmd_lote_individual)
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
          .is('deleted_at', null)
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

// ── Escritas (via fila de sync — funcionam offline e drenam ao reconectar) ────
//
// As páginas chamam estas funções normalmente. Online, a escrita vai ao servidor
// na hora (erro de negócio é propagado); offline, é enfileirada + projetada no
// cache e sincronizada quando a rede voltar. Ver src/lib/sync/engine.ts.

/**
 * Registra uma COMPRA: cria o lote (+N animais) e grava a transação/compra.
 * Sequência transacional reexecutada no servidor por src/lib/sync/handlers.ts.
 */
export async function registrarCompra(input: {
  userId: string;
  nomeLote: string;
  qtdCabecas: number;
  pesoTotalKg: number;
  pesoEntradaKg: number;
  valorTotal: number;
  valorPorArroba: number;
  dataEntrada: string;
  pastoId?: string | null;
  sexo?: string;
  categoria?: string | null;
  descricao: string;
}): Promise<void> {
  await enqueue('COMPRA', {
    userId: input.userId,
    tempLoteId: crypto.randomUUID(),
    nomeLote: input.nomeLote,
    qtdCabecas: input.qtdCabecas,
    pesoTotalKg: input.pesoTotalKg,
    pesoEntradaKg: input.pesoEntradaKg,
    valorTotal: input.valorTotal,
    valorPorArroba: input.valorPorArroba,
    dataEntrada: input.dataEntrada,
    pastoId: input.pastoId ?? null,
    sexo: input.sexo ?? 'Misto',
    categoria: input.categoria ?? null,
    descricao: input.descricao,
  });
}

/**
 * Registra uma VENDA: grava a transação/venda e fecha N vínculos (saída) no lote.
 */
export async function registrarVenda(input: {
  userId: string;
  loteId: string;
  qtdCabecas: number;
  pesoTotalKg: number;
  valorTotal: number;
  valorPorArroba: number;
  data: string;
  descricao: string;
}): Promise<void> {
  await enqueue('VENDA', {
    userId: input.userId,
    loteId: input.loteId,
    qtdCabecas: input.qtdCabecas,
    pesoTotalKg: input.pesoTotalKg,
    valorTotal: input.valorTotal,
    valorPorArroba: input.valorPorArroba,
    data: input.data,
    descricao: input.descricao,
  });
}

/** Registra pesagem de lote total. O snapshot de cabeças é calculado no servidor. */
export async function registrarPesagemLoteTotal(input: {
  userId: string;
  loteId: string;
  data: string;
  pesoTotalKg: number;
  observacao?: string | null;
}): Promise<void> {
  await enqueue('PESAGEM_LOTE', {
    userId: input.userId,
    loteId: input.loteId,
    data: input.data,
    pesoTotalKg: input.pesoTotalKg,
    observacao: input.observacao ?? null,
  });
}

/** Registra a pesagem individual de um animal (upsert por animal+dia no servidor). */
export async function registrarPesagemIndividual(input: {
  userId: string;
  loteId: string;
  animalId: string;
  data: string;
  pesoKg: number;
}): Promise<void> {
  await enqueue('PESAGEM_INDIVIDUAL', {
    userId: input.userId,
    loteId: input.loteId,
    animalId: input.animalId,
    data: input.data,
    pesoKg: input.pesoKg,
  });
}

/** Atribui/atualiza o brinco (visual e/ou RFID) de um animal. */
export async function etiquetarAnimal(input: {
  userId: string;
  animalId: string;
  brincoVisual: string | null;
  brincoRfid: string | null;
}): Promise<void> {
  await enqueue('ETIQUETAR_ANIMAL', {
    userId: input.userId,
    animalId: input.animalId,
    brincoVisual: input.brincoVisual,
    brincoRfid: input.brincoRfid,
  });
}

/** Registra baixa (mortalidade): fecha N vínculos e mantém os contadores coerentes. */
export async function registrarBaixa(input: {
  userId: string;
  loteId: string;
  qtd: number;
  data: string;
  motivo?: string;
}): Promise<void> {
  await enqueue('BAIXA', {
    userId: input.userId,
    loteId: input.loteId,
    qtd: input.qtd,
    data: input.data,
    motivo: input.motivo ?? 'Mortalidade',
  });
}

/** Exclui o lote em cascata (novo modelo + legado) de forma transacional no servidor. */
export async function excluirLote(loteId: string, userId: string): Promise<void> {
  await enqueue('EXCLUIR_LOTE', { userId, loteId });
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
