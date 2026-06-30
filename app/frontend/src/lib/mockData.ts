/**
 * Dados fictícios para o MODO PREVIEW (VITE_PREVIEW_MOCK=true).
 * Código descartável — usado apenas para visualizar as telas sem backend real.
 * Para remover: apague mockData.ts, mockSupabase.ts e o bloco de mock em supabase.ts.
 */

const PREFIX = 'app_34b6ab49dc_';
export const T = {
  profiles: `${PREFIX}profiles`,
  lotes: `${PREFIX}lotes`,
  transacoes: `${PREFIX}transacoes`,
  compras_vendas: `${PREFIX}compras_vendas`,
  pesagens: `${PREFIX}pesagens`,
  parametros_fazenda: `${PREFIX}parametros_fazenda`,
  pastos: `${PREFIX}pastos`,
  baixas: `${PREFIX}baixas`,
  pesagens_lote: `${PREFIX}pesagens_lote`,
};

export const MOCK_USER = {
  id: 'mock-user-0001',
  email: 'demo@manejocerto.com.br',
  user_metadata: { nome_fazenda: 'Fazenda Boa Vista' },
};

const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
/** Dia específico do mês atual (para o Dashboard "Mês Atual"). */
const dom = (day: number) => new Date(y, m, Math.min(day, 28)).toISOString().split('T')[0];
/** N dias atrás. */
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const stamp = (day: number) => new Date(y, m, Math.min(day, 28), 10, 0, 0).toISOString();
/** Dia de um mês anterior (monthsBack atrás), para o gráfico de 6 meses. */
const prevMonth = (monthsBack: number, day = 15) =>
  new Date(y, m - monthsBack, Math.min(day, 28)).toISOString().split('T')[0];

const U = MOCK_USER.id;

export function buildMockDB(): Record<string, Record<string, unknown>[]> {
  return {
    [T.profiles]: [
      { id: U, nome_fazenda: 'Fazenda Boa Vista', created_at: daysAgo(400) },
    ],

    [T.pastos]: [
      { id: 'pasto-1', user_id: U, nome_pasto: 'Pasto 1 - Sede', capacidade_cabecas: 60, created_at: daysAgo(300) },
      { id: 'pasto-2', user_id: U, nome_pasto: 'Pasto 2 - Fundo', capacidade_cabecas: 40, created_at: daysAgo(300) },
    ],

    [T.lotes]: [
      {
        id: 'lote-1', user_id: U, nome_lote: 'Nelore Recria 2026', qtd_cabecas: 49, qtd_cabecas_vendidas: 0,
        status: 'ativo', data_entrada: daysAgo(70), peso_entrada_kg: 280, pasto_id: 'pasto-1',
        sexo: 'Macho', categoria: 'Garrotes', created_at: daysAgo(70),
      },
      {
        id: 'lote-2', user_id: U, nome_lote: 'Novilhas Engorda', qtd_cabecas: 30, qtd_cabecas_vendidas: 0,
        status: 'ativo', data_entrada: daysAgo(45), peso_entrada_kg: 240, pasto_id: 'pasto-2',
        sexo: 'Fêmea', categoria: 'Novilhas', created_at: daysAgo(45),
      },
      {
        id: 'lote-3', user_id: U, nome_lote: 'Bois Gordos 2025', qtd_cabecas: 40, qtd_cabecas_vendidas: 40,
        status: 'encerrado', data_entrada: daysAgo(320), peso_entrada_kg: 380, pasto_id: null,
        sexo: 'Macho', categoria: 'Bois', created_at: daysAgo(320),
      },
    ],

    [T.transacoes]: [
      // Lançamentos do mês atual (aparecem no Dashboard "Mês Atual")
      { id: 'tx-1', user_id: U, tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 84000, data: dom(2), lote_id: 'lote-1', descricao: 'Compra de 50 cabeças', created_at: stamp(2) },
      { id: 'tx-2', user_id: U, tipo: 'DESPESA', categoria: 'INSUMOS', valor: 3500, data: dom(5), lote_id: 'lote-1', descricao: 'Ração e suplemento mineral', created_at: stamp(5) },
      { id: 'tx-3', user_id: U, tipo: 'DESPESA', categoria: 'PESSOAL', valor: 2800, data: dom(5), lote_id: null, descricao: 'Salário peão', created_at: stamp(5) },
      { id: 'tx-4', user_id: U, tipo: 'DESPESA', categoria: 'INFRA', valor: 4200, data: dom(8), lote_id: null, descricao: 'Conserto de cerca', created_at: stamp(8) },
      { id: 'tx-5', user_id: U, tipo: 'DESPESA', categoria: 'MAQUINARIO', valor: 1200, data: dom(12), lote_id: null, descricao: 'Diesel do trator', created_at: stamp(12) },
      { id: 'tx-6', user_id: U, tipo: 'RECEITA', categoria: 'VENDA_GADO', valor: 72000, data: dom(18), lote_id: 'lote-3', descricao: 'Venda de 40 bois gordos', created_at: stamp(18) },
      { id: 'tx-7', user_id: U, tipo: 'DESPESA', categoria: 'INSUMOS', valor: 1800, data: dom(22), lote_id: 'lote-2', descricao: 'Vacinas', created_at: stamp(22) },
      { id: 'tx-8', user_id: U, tipo: 'RECEITA', categoria: 'OUTROS', valor: 1500, data: dom(25), lote_id: null, descricao: 'Venda de esterco', created_at: stamp(25) },

      // Histórico (meses anteriores) — alimentam o gráfico de 6 meses
      { id: 'tx-h1', user_id: U, tipo: 'DESPESA', categoria: 'INSUMOS', valor: 5200, data: prevMonth(1, 10), lote_id: null, descricao: 'Ração', created_at: prevMonth(1, 10) },
      { id: 'tx-h2', user_id: U, tipo: 'RECEITA', categoria: 'VENDA_GADO', valor: 38000, data: prevMonth(1, 20), lote_id: null, descricao: 'Venda parcial', created_at: prevMonth(1, 20) },
      { id: 'tx-h3', user_id: U, tipo: 'DESPESA', categoria: 'PESSOAL', valor: 2800, data: prevMonth(2, 5), lote_id: null, descricao: 'Salários', created_at: prevMonth(2, 5) },
      { id: 'tx-h4', user_id: U, tipo: 'RECEITA', categoria: 'VENDA_GADO', valor: 52000, data: prevMonth(2, 22), lote_id: null, descricao: 'Venda de bezerros', created_at: prevMonth(2, 22) },
      { id: 'tx-h5', user_id: U, tipo: 'DESPESA', categoria: 'INFRA', valor: 8900, data: prevMonth(3, 14), lote_id: null, descricao: 'Reforma do curral', created_at: prevMonth(3, 14) },
      { id: 'tx-h6', user_id: U, tipo: 'DESPESA', categoria: 'INSUMOS', valor: 4100, data: prevMonth(4, 12), lote_id: null, descricao: 'Vacinas e vermífugos', created_at: prevMonth(4, 12) },
      { id: 'tx-h7', user_id: U, tipo: 'RECEITA', categoria: 'VENDA_GADO', valor: 61000, data: prevMonth(4, 26), lote_id: null, descricao: 'Venda de boiada', created_at: prevMonth(4, 26) },
      { id: 'tx-h8', user_id: U, tipo: 'DESPESA', categoria: 'MAQUINARIO', valor: 3300, data: prevMonth(5, 9), lote_id: null, descricao: 'Manutenção trator', created_at: prevMonth(5, 9) },
    ],

    [T.compras_vendas]: [
      { id: 'cv-1', transacao_id: 'tx-1', lote_id: 'lote-1', qtd_cabecas: 50, peso_total_kg: 14000, valor_por_arroba: 270, created_at: stamp(2) },
      { id: 'cv-2', transacao_id: 'tx-6', lote_id: 'lote-3', qtd_cabecas: 40, peso_total_kg: 22000, valor_por_arroba: 295, created_at: stamp(18) },
    ],

    [T.pesagens_lote]: [
      { id: 'pl-1', lote_id: 'lote-1', user_id: U, data_pesagem: daysAgo(40), peso_total_kg: 14000, created_at: daysAgo(40) },
      { id: 'pl-2', lote_id: 'lote-1', user_id: U, data_pesagem: daysAgo(10), peso_total_kg: 15600, created_at: daysAgo(10) },
      { id: 'pl-3', lote_id: 'lote-2', user_id: U, data_pesagem: daysAgo(15), peso_total_kg: 7800, created_at: daysAgo(15) },
    ],

    [T.pesagens]: [],

    [T.baixas]: [
      { id: 'bx-1', lote_id: 'lote-1', user_id: U, data_baixa: daysAgo(20), quantidade: 1, motivo: 'Mortalidade', created_at: daysAgo(20) },
    ],

    [T.parametros_fazenda]: [
      { id: 'pm-1', user_id: U, fase_manejo: 'Recria', custo_diario_cabeca: 5.5, gmd_esperado_kg: 0.6, rendimento_carcaca_perc: 50, mortalidade_esperada_perc: 2, created_at: daysAgo(200) },
      { id: 'pm-2', user_id: U, fase_manejo: 'Engorda', custo_diario_cabeca: 8.0, gmd_esperado_kg: 1.1, rendimento_carcaca_perc: 53, mortalidade_esperada_perc: 1.5, created_at: daysAgo(200) },
      { id: 'pm-3', user_id: U, fase_manejo: 'Confinamento', custo_diario_cabeca: 14.0, gmd_esperado_kg: 1.5, rendimento_carcaca_perc: 56, mortalidade_esperada_perc: 1, created_at: daysAgo(200) },
    ],
  };
}
