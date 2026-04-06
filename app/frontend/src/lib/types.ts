export interface Profile {
  id: string;
  nome_fazenda: string;
  created_at: string;
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
  created_at: string;
}

export type CategoriaTransacao =
  | 'VENDA_GADO'
  | 'COMPRA_GADO'
  | 'INSUMOS'
  | 'INFRA'
  | 'MAQUINARIO'
  | 'PESSOAL'
  | 'OUTROS';

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

export const CATEGORIA_LABELS: Record<CategoriaTransacao, string> = {
  VENDA_GADO: 'Venda de Gado',
  COMPRA_GADO: 'Compra de Gado',
  INSUMOS: 'Insumos',
  INFRA: 'Infraestrutura',
  MAQUINARIO: 'Maquinário',
  PESSOAL: 'Pessoal',
  OUTROS: 'Outros',
};

export const CATEGORIA_ICONS: Record<CategoriaTransacao, string> = {
  VENDA_GADO: 'TrendingUp',
  COMPRA_GADO: 'ShoppingCart',
  INSUMOS: 'Package',
  INFRA: 'Building',
  MAQUINARIO: 'Wrench',
  PESSOAL: 'Users',
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