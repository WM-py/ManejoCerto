export interface Profile {
  id: string;
  nome_fazenda: string;
  created_at: string;
  trial_start?: string | null;
  trial_end?: string | null;
  plan?: 'trial' | 'annual' | 'lifetime' | string | null;
  plan_status?: 'trialing' | 'active' | 'expired' | 'canceled' | null;
}

export type SexoLote = 'Macho' | 'Fêmea' | 'Misto';

export interface Lote {
  id: string;
  user_id: string;
  nome_lote: string;
  qtd_cabecas: number;
  qtd_cabecas_vendidas: number;
  status: 'ativo' | 'encerrado';
  data_entrada: string;
  peso_entrada_kg: number;
  pasto_id: string | null;
  sexo?: SexoLote;
  categoria?: string;
  created_at: string;
}

/** Categorization engine based on sex and average weight */
export function calcularCategoria(sexo: SexoLote, pesoMedioKg: number): string {
  if (sexo === 'Misto') return 'Lote Misto';
  if (sexo === 'Macho') {
    if (pesoMedioKg <= 210) return 'Bezerros';
    if (pesoMedioKg <= 360) return 'Garrotes';
    return 'Bois';
  }
  // Fêmea
  if (pesoMedioKg <= 210) return 'Bezerras';
  if (pesoMedioKg <= 300) return 'Novilhas';
  return 'Vacas';
}

export interface Pasto {
  id: string;
  user_id: string;
  nome_pasto: string;
  capacidade_cabecas: number;
  created_at: string;
}

export interface Baixa {
  id: string;
  lote_id: string;
  user_id: string;
  data_baixa: string;
  quantidade: number;
  motivo: string;
  created_at: string;
}

export interface PesagemLote {
  id: string;
  lote_id: string;
  user_id: string;
  data_pesagem: string;
  peso_total_kg: number;
  created_at: string;
}

export interface Transacao {
  id: string;
  user_id: string;
  tipo: 'RECEITA' | 'DESPESA';
  categoria: CategoriaTransacao;
  valor: number;
  data: string;
  lote_id: string | null;
  descricao: string;
  comprovante_path?: string | null;
  created_at: string;
}

export type CategoriaTransacao =
  | 'VENDA_GADO'
  | 'COMPRA_GADO'
  | 'INSUMOS'
  | 'INFRA'
  | 'MAQUINARIO'
  | 'PESSOAL'
  | 'OUTROS'
  | 'NUTRICAO'
  | 'SANIDADE'
  | 'COMBUSTIVEL'
  | 'FRETE'
  | 'ARRENDAMENTO'
  | 'IMPOSTOS';

export interface CompraVenda {
  id: string;
  transacao_id: string;
  lote_id: string;
  qtd_cabecas: number;
  peso_total_kg: number;
  valor_por_arroba: number;
  created_at: string;
}

export interface Pesagem {
  id: string;
  lote_id: string;
  user_id: string;
  data_pesagem: string;
  peso_media_kg: number;
  gmd_calculado: number;
  created_at: string;
}

// ============================================================================
// Sprint 0 — Modelo por animal (brinco). Aditivo; convive com o legado acima.
// ============================================================================

export type StatusAnimal = 'ativo' | 'vendido' | 'morto' | 'transferido';

/** Identidade individual do animal. Persiste entre lotes. */
export interface Animal {
  id: string;
  user_id: string;
  brinco_visual: string | null;
  brinco_rfid: string | null;
  sexo: 'Macho' | 'Fêmea' | null;
  raca: string | null;
  data_nascimento: string | null;
  origem: string | null;
  status: StatusAnimal;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Vínculo animal↔lote por período (data_saida null = ativo no lote). */
export interface LoteAnimal {
  id: string;
  user_id: string;
  animal_id: string;
  lote_id: string;
  data_entrada: string;
  peso_entrada_kg: number | null;
  data_saida: string | null;
  motivo_saida: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type TipoPesagemEvento = 'individual' | 'lote_total';

/** Sessão de pesagem no curral. Guarda o snapshot de cabeças no lote_total. */
export interface PesagemEvento {
  id: string;
  user_id: string;
  lote_id: string;
  data_pesagem: string;
  tipo: TipoPesagemEvento;
  peso_total_kg: number | null;
  qtd_cabecas_pesadas: number | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Pesagem por animal (base do ML). Sem GMD persistido — é derivado nas views. */
export interface PesagemAnimal {
  id: string;
  user_id: string;
  animal_id: string;
  lote_id: string | null;
  evento_id: string | null;
  data_pesagem: string;
  peso_kg: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Vínculo do animal no lote + campos de identidade (join lote_animais↔animais). */
export interface AnimalVinculo {
  animal_id: string;
  data_entrada: string;
  peso_entrada_kg: number | null;
  animais: Pick<Animal, 'id' | 'brinco_visual' | 'brinco_rfid' | 'sexo'> | null;
}

// ── Views (somente leitura) ────────────────────────────────────────────────

/** v_gmd_animal — GMD entre pesagens consecutivas do mesmo animal. */
export interface GmdAnimal {
  animal_id: string;
  lote_id: string | null;
  data_pesagem: string;
  peso_kg: number;
  peso_ant: number | null;
  data_ant: string | null;
  gmd_kg_dia: number | null;
}

/** v_gmd_lote_evento — GMD do lote via peso total, usando o snapshot congelado. */
export interface GmdLoteEvento {
  lote_id: string;
  data_pesagem: string;
  peso_medio: number;
  peso_medio_ant: number | null;
  gmd_kg_dia: number | null;
}

/** v_gmd_lote_individual — GMD médio do lote a partir das pesagens por animal. */
export interface GmdLoteIndividual {
  lote_id: string;
  data_pesagem: string;
  gmd_medio_kg_dia: number | null;
  animais_considerados: number;
}

/** v_lote_rebanho — contagens de cabeças derivadas do vínculo (fonte de verdade). */
export interface LoteRebanho {
  lote_id: string;
  cabecas_vivas: number;
  cabecas_total: number;
  cabecas_vendidas: number;
  cabecas_baixa: number;
}

export const CATEGORIA_LABELS: Record<CategoriaTransacao, string> = {
  VENDA_GADO: 'Venda de Gado',
  COMPRA_GADO: 'Compra de Gado',
  NUTRICAO: 'Nutrição',
  SANIDADE: 'Sanidade',
  INSUMOS: 'Insumos',
  INFRA: 'Infraestrutura',
  MAQUINARIO: 'Maquinário',
  COMBUSTIVEL: 'Combustível',
  FRETE: 'Frete / Transporte',
  ARRENDAMENTO: 'Arrendamento',
  PESSOAL: 'Pessoal',
  IMPOSTOS: 'Impostos / Taxas',
  OUTROS: 'Outros',
};

export const CATEGORIA_ICONS: Record<CategoriaTransacao, string> = {
  VENDA_GADO: 'TrendingUp',
  COMPRA_GADO: 'ShoppingCart',
  NUTRICAO: 'Wheat',
  SANIDADE: 'Syringe',
  INSUMOS: 'Package',
  INFRA: 'Building',
  MAQUINARIO: 'Wrench',
  COMBUSTIVEL: 'Fuel',
  FRETE: 'Truck',
  ARRENDAMENTO: 'Sprout',
  PESSOAL: 'Users',
  IMPOSTOS: 'Receipt',
  OUTROS: 'MoreHorizontal',
};

export interface ParametroFazenda {
  id: string;
  user_id: string;
  fase_manejo: string;
  custo_diario_cabeca: number;
  gmd_esperado_kg: number;
  rendimento_carcaca_perc: number;
  mortalidade_esperada_perc: number;
  created_at: string;
}

export const FASES_MANEJO = ['Recria', 'Engorda', 'Confinamento'] as const;
export type FaseManejo = (typeof FASES_MANEJO)[number];