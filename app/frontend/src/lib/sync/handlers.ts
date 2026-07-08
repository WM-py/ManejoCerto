/**
 * Handlers de sincronização — a lógica que efetivamente fala com o servidor.
 *
 * Cada handler reexecuta a MESMA sequência de RPCs/inserts que o app fazia
 * inline antes da fila. Nada de novo no banco: reaproveitamos os 5 RPCs do
 * Sprint 0. Um handler pode retornar um IntentResult (mapa tempId→id real)
 * quando cria uma entidade nova no servidor (caso da COMPRA → lote).
 */
import { supabase, TABLES, RPC, COMPROVANTES_BUCKET } from '@/lib/supabase';
import type { OutboxRecord } from '@/lib/cache/db';
import type {
  CompraPayload,
  VendaPayload,
  PesagemLotePayload,
  PesagemIndividualPayload,
  EtiquetarAnimalPayload,
  BaixaPayload,
  ExcluirLotePayload,
  LancamentoPayload,
  IntentResult,
} from './types';

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function handleCompra(p: CompraPayload): Promise<IntentResult> {
  // 1) RPC transacional: cria o lote E gera N animais + vínculos.
  const { data: loteId, error: rpcErr } = await supabase.rpc(RPC.criarLoteComAnimais, {
    p_nome_lote: p.nomeLote,
    p_qtd_cabecas: p.qtdCabecas,
    p_peso_entrada_kg: p.pesoEntradaKg,
    p_data_entrada: p.dataEntrada,
    p_pasto_id: p.pastoId,
    p_sexo: p.sexo,
    p_categoria: p.categoria,
  });
  throwIf(rpcErr);
  const realLoteId = loteId as string;

  // 2) Transação financeira (despesa da compra).
  const { data: transacao, error: transErr } = await supabase
    .from(TABLES.transacoes)
    .insert({
      user_id: p.userId,
      tipo: 'DESPESA',
      categoria: 'COMPRA_GADO',
      valor: p.valorTotal,
      data: p.dataEntrada,
      lote_id: realLoteId,
      descricao: p.descricao,
    })
    .select()
    .single();
  throwIf(transErr);

  // 3) Detalhe compra/venda.
  const { error: cvErr } = await supabase.from(TABLES.compras_vendas).insert({
    transacao_id: (transacao as { id: string }).id,
    lote_id: realLoteId,
    qtd_cabecas: p.qtdCabecas,
    peso_total_kg: p.pesoTotalKg,
    valor_por_arroba: p.valorPorArroba,
    contraparte: p.contraparte,
  });
  throwIf(cvErr);

  return { tempId: p.tempLoteId, realId: realLoteId };
}

async function handleVenda(p: VendaPayload): Promise<void> {
  const { data: transacao, error: transErr } = await supabase
    .from(TABLES.transacoes)
    .insert({
      user_id: p.userId,
      tipo: 'RECEITA',
      categoria: 'VENDA_GADO',
      valor: p.valorTotal,
      data: p.data,
      lote_id: p.loteId,
      descricao: p.descricao,
    })
    .select()
    .single();
  throwIf(transErr);

  const { error: cvErr } = await supabase.from(TABLES.compras_vendas).insert({
    transacao_id: (transacao as { id: string }).id,
    lote_id: p.loteId,
    qtd_cabecas: p.qtdCabecas,
    peso_total_kg: p.pesoTotalKg,
    valor_por_arroba: p.valorPorArroba,
    contraparte: p.contraparte,
  });
  throwIf(cvErr);

  // RPC: fecha N vínculos (motivo='venda'), marca animais e atualiza o cache.
  const { error: saidaErr } = await supabase.rpc(RPC.registrarVendaSaida, {
    p_lote_id: p.loteId,
    p_qtd: p.qtdCabecas,
    p_data: p.data,
  });
  throwIf(saidaErr);
}

async function handlePesagemLote(p: PesagemLotePayload): Promise<void> {
  const { error } = await supabase.rpc(RPC.registrarPesagemLoteTotal, {
    p_lote_id: p.loteId,
    p_data: p.data,
    p_peso_total_kg: p.pesoTotalKg,
    p_observacao: p.observacao,
  });
  throwIf(error);
}

async function handlePesagemIndividual(p: PesagemIndividualPayload): Promise<void> {
  const { error } = await supabase.rpc(RPC.registrarPesagemIndividual, {
    p_lote_id: p.loteId,
    p_animal_id: p.animalId,
    p_data: p.data,
    p_peso_kg: p.pesoKg,
  });
  throwIf(error);
}

async function handleEtiquetarAnimal(p: EtiquetarAnimalPayload): Promise<void> {
  const { error } = await supabase
    .from(TABLES.animais)
    .update({ brinco_visual: p.brincoVisual, brinco_rfid: p.brincoRfid })
    .eq('id', p.animalId)
    .eq('user_id', p.userId);
  if (error && (error as { code?: string }).code === '23505') {
    throw new Error('Esse brinco já está em uso em outro animal.');
  }
  throwIf(error);
}

async function handleBaixa(p: BaixaPayload): Promise<void> {
  const { error } = await supabase.rpc(RPC.registrarBaixa, {
    p_lote_id: p.loteId,
    p_qtd: p.qtd,
    p_data: p.data,
    p_motivo: p.motivo,
  });
  throwIf(error);
}

async function handleExcluirLote(p: ExcluirLotePayload): Promise<void> {
  const { error } = await supabase.rpc(RPC.excluirLote, { p_lote_id: p.loteId });
  throwIf(error);
}

async function handleLancamento(p: LancamentoPayload): Promise<void> {
  // 1) Comprovante primeiro (se houver). Path fixo + upsert = replay idempotente.
  let comprovantePath: string | null = null;
  if (p.comprovante && p.comprovantePath) {
    const { error: upErr } = await supabase.storage
      .from(COMPROVANTES_BUCKET)
      .upload(p.comprovantePath, p.comprovante, {
        contentType: p.comprovante.type || undefined,
        upsert: true,
      });
    if (upErr) throw new Error(`Falha ao enviar o comprovante: ${upErr.message}`);
    comprovantePath = p.comprovantePath;
  }

  // 2) Transação financeira.
  const { error } = await supabase.from(TABLES.transacoes).insert({
    user_id: p.userId,
    tipo: p.tipo,
    categoria: p.categoria,
    valor: p.valor,
    data: p.data,
    lote_id: p.loteId,
    descricao: p.descricao,
    comprovante_path: comprovantePath,
  });
  throwIf(error);
}

/** Executa a intenção no servidor. Retorna IntentResult quando há id novo a reconciliar. */
export async function executeIntent(record: OutboxRecord): Promise<IntentResult | void> {
  switch (record.kind) {
    case 'COMPRA':
      return handleCompra(record.payload as unknown as CompraPayload);
    case 'VENDA':
      return handleVenda(record.payload as unknown as VendaPayload);
    case 'PESAGEM_LOTE':
      return handlePesagemLote(record.payload as unknown as PesagemLotePayload);
    case 'PESAGEM_INDIVIDUAL':
      return handlePesagemIndividual(record.payload as unknown as PesagemIndividualPayload);
    case 'ETIQUETAR_ANIMAL':
      return handleEtiquetarAnimal(record.payload as unknown as EtiquetarAnimalPayload);
    case 'BAIXA':
      return handleBaixa(record.payload as unknown as BaixaPayload);
    case 'EXCLUIR_LOTE':
      return handleExcluirLote(record.payload as unknown as ExcluirLotePayload);
    case 'LANCAMENTO':
      return handleLancamento(record.payload as unknown as LancamentoPayload);
    default: {
      // Exhaustiveness: força erro de compilação se surgir um kind novo.
      const _never: never = record.kind;
      throw new Error(`Intent desconhecida: ${String(_never)}`);
    }
  }
}
