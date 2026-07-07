/**
 * Payloads das intenções de escrita da fila de sync (Fase 3).
 *
 * Cada intenção carrega tudo que o handler precisa para reexecutar a sequência
 * de RPCs/inserts no servidor — de forma que uma escrita feita offline possa ser
 * replayed intacta ao reconectar.
 */
import type { OutboxKind } from '@/lib/cache/db';

export interface CompraPayload {
  userId: string;
  /** lote_id temporário gerado no cliente; reconciliado com o id real ao sincronizar. */
  tempLoteId: string;
  nomeLote: string;
  qtdCabecas: number;
  pesoTotalKg: number;
  pesoEntradaKg: number;
  valorTotal: number;
  valorPorArroba: number;
  dataEntrada: string;
  pastoId: string | null;
  sexo: string;
  categoria: string | null;
  descricao: string;
  contraparte: string | null;
}

export interface VendaPayload {
  userId: string;
  loteId: string;
  qtdCabecas: number;
  pesoTotalKg: number;
  valorTotal: number;
  valorPorArroba: number;
  data: string;
  descricao: string;
  contraparte: string | null;
}

export interface PesagemLotePayload {
  userId: string;
  loteId: string;
  data: string;
  pesoTotalKg: number;
  observacao: string | null;
}

export interface PesagemIndividualPayload {
  userId: string;
  loteId: string;
  animalId: string;
  data: string;
  pesoKg: number;
}

export interface EtiquetarAnimalPayload {
  userId: string;
  animalId: string;
  brincoVisual: string | null;
  brincoRfid: string | null;
}

export interface BaixaPayload {
  userId: string;
  loteId: string;
  qtd: number;
  data: string;
  motivo: string;
}

export interface ExcluirLotePayload {
  userId: string;
  loteId: string;
}

export type IntentPayloadMap = {
  COMPRA: CompraPayload;
  VENDA: VendaPayload;
  PESAGEM_LOTE: PesagemLotePayload;
  PESAGEM_INDIVIDUAL: PesagemIndividualPayload;
  ETIQUETAR_ANIMAL: EtiquetarAnimalPayload;
  BAIXA: BaixaPayload;
  EXCLUIR_LOTE: ExcluirLotePayload;
};

export type IntentPayload = IntentPayloadMap[OutboxKind];

/** Resultado opcional de um handler: mapeamento de id temporário → id real. */
export interface IntentResult {
  tempId: string;
  realId: string;
}
