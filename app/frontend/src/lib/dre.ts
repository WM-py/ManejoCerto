// DRE por lote — extraído de LoteDetalhe.tsx para ser testável isoladamente.
// É o cálculo central do produto: custo acumulado, ponto de equilíbrio,
// lucro e margem de cada lote.
import { kgToArrobas } from './format';
import type { PesagemEvento, Transacao } from './types';

export interface DREInput {
  transacoes: Pick<Transacao, 'tipo' | 'categoria' | 'valor'>[];
  loteStatus: 'ativo' | 'encerrado';
  qtdCabecas: number;
  /** Cabeças vivas hoje (fonte de verdade: rebanho derivado do vínculo animal↔lote). */
  cabecasVivas: number;
  /** Peso médio atual por cabeça, kg (última pesagem de lote total, ou peso de entrada). */
  pesoAtualMedioKg: number;
}

export interface DREResult {
  receitasDiretas: number;
  custoCompra: number;
  custosOperacionais: number;
  custoAcumulado: number;
  custoPorCabecaViva: number;
  arrobasRestantes: number;
  pontoEquilibrio: number;
  lucroLiquido: number;
  lucroPorCabeca: number;
  margemLucro: number;
  lucroProjetado: number;
}

/** Peso médio atual por cabeça: última pesagem de lote total, senão o peso de entrada. */
export function calcularPesoAtualMedio(
  eventosLoteTotal: Pick<PesagemEvento, 'peso_total_kg' | 'qtd_cabecas_pesadas'>[],
  pesoEntradaKg: number
): number {
  const lastEvento =
    eventosLoteTotal.length > 0 ? eventosLoteTotal[eventosLoteTotal.length - 1] : null;
  if (lastEvento && lastEvento.peso_total_kg && lastEvento.qtd_cabecas_pesadas) {
    return Number(lastEvento.peso_total_kg) / Number(lastEvento.qtd_cabecas_pesadas);
  }
  return Number(pesoEntradaKg) || 0;
}

export function calcularDRE(input: DREInput): DREResult {
  const receitasDiretas = input.transacoes
    .filter((t) => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custoCompra = input.transacoes
    .filter((t) => t.tipo === 'DESPESA' && t.categoria === 'COMPRA_GADO')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custosOperacionais = input.transacoes
    .filter((t) => t.tipo === 'DESPESA' && t.categoria !== 'COMPRA_GADO')
    .reduce((sum, t) => sum + Number(t.valor), 0);

  const custoAcumulado = custoCompra + custosOperacionais;

  const custoPorCabecaViva = input.cabecasVivas > 0 ? custoAcumulado / input.cabecasVivas : 0;
  const arrobasRestantes = kgToArrobas(input.pesoAtualMedioKg * input.cabecasVivas);
  const pontoEquilibrio = arrobasRestantes > 0 ? custoAcumulado / arrobasRestantes : 0;

  const lucroLiquido = receitasDiretas - custoAcumulado;
  const lucroPorCabeca = input.qtdCabecas > 0 ? lucroLiquido / input.qtdCabecas : 0;
  const margemLucro = receitasDiretas > 0 ? (lucroLiquido / receitasDiretas) * 100 : 0;

  const lucroProjetado =
    input.loteStatus === 'ativo' && pontoEquilibrio > 0
      ? arrobasRestantes * pontoEquilibrio * 1.15 - custoAcumulado
      : 0;

  return {
    receitasDiretas,
    custoCompra,
    custosOperacionais,
    custoAcumulado,
    custoPorCabecaViva,
    arrobasRestantes,
    pontoEquilibrio,
    lucroLiquido,
    lucroPorCabeca,
    margemLucro,
    lucroProjetado,
  };
}
