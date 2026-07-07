import { describe, it, expect } from 'vitest';
import { calcularDRE, calcularPesoAtualMedio, type DREInput } from './dre';
import type { Transacao } from './types';

function transacao(overrides: Partial<Transacao>): Pick<Transacao, 'tipo' | 'categoria' | 'valor'> {
  return {
    tipo: 'DESPESA',
    categoria: 'OUTROS',
    valor: 0,
    ...overrides,
  };
}

describe('calcularPesoAtualMedio', () => {
  it('usa o peso de entrada quando não há pesagem de lote registrada', () => {
    expect(calcularPesoAtualMedio([], 350)).toBe(350);
  });

  it('usa a última pesagem de lote total (peso total / cabeças pesadas)', () => {
    const eventos = [
      { peso_total_kg: 10000, qtd_cabecas_pesadas: 50 },
      { peso_total_kg: 12000, qtd_cabecas_pesadas: 50 },
    ];
    expect(calcularPesoAtualMedio(eventos, 350)).toBe(240);
  });

  it('ignora evento com peso ou cabeças zerados e cai no peso de entrada', () => {
    expect(calcularPesoAtualMedio([{ peso_total_kg: 0, qtd_cabecas_pesadas: 50 }], 350)).toBe(350);
  });
});

describe('calcularDRE', () => {
  const base: DREInput = {
    transacoes: [],
    loteStatus: 'ativo',
    qtdCabecas: 50,
    cabecasVivas: 50,
    pesoAtualMedioKg: 300, // 10 @/cabeça
  };

  it('lote de compra sem venda ainda: sem receita, sem lucro, com ponto de equilíbrio', () => {
    const r = calcularDRE({
      ...base,
      transacoes: [
        transacao({ tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 100000 }),
        transacao({ tipo: 'DESPESA', categoria: 'NUTRICAO', valor: 5000 }),
      ],
    });
    // custo total 105.000 / (300kg*50cab / 30 = 500 @) = R$210/@
    expect(r.custoAcumulado).toBe(105000);
    expect(r.receitasDiretas).toBe(0);
    expect(r.pontoEquilibrio).toBe(210);
    expect(r.lucroLiquido).toBe(-105000); // sem receita, lucro líquido é negativo do custo
    expect(r.margemLucro).toBe(0); // sem receita, margem não é calculável -> 0
  });

  it('lote vendido com lucro: margem e lucro por cabeça positivos', () => {
    const r = calcularDRE({
      ...base,
      loteStatus: 'encerrado',
      transacoes: [
        transacao({ tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 100000 }),
        transacao({ tipo: 'RECEITA', categoria: 'VENDA_GADO', valor: 150000 }),
      ],
    });
    expect(r.custoAcumulado).toBe(100000);
    expect(r.receitasDiretas).toBe(150000);
    expect(r.lucroLiquido).toBe(50000);
    expect(r.lucroPorCabeca).toBe(1000);
    expect(r.margemLucro).toBeCloseTo(33.33, 1);
  });

  it('lote encerrado nunca projeta lucro futuro (lucroProjetado = 0)', () => {
    const r = calcularDRE({
      ...base,
      loteStatus: 'encerrado',
      transacoes: [transacao({ tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 100000 })],
    });
    expect(r.lucroProjetado).toBe(0);
  });

  it('lote ativo projeta lucro com margem de 15% sobre o ponto de equilíbrio', () => {
    const r = calcularDRE({
      ...base,
      loteStatus: 'ativo',
      transacoes: [transacao({ tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 100000 })],
    });
    // pontoEquilibrio = 100000/500 = 200; projetado = 500*200*1.15 - 100000 = 15000
    expect(r.pontoEquilibrio).toBe(200);
    expect(r.lucroProjetado).toBeCloseTo(15000, 6);
  });

  it('sem cabeças vivas (todas mortas/vendidas): não divide por zero', () => {
    const r = calcularDRE({
      ...base,
      cabecasVivas: 0,
      transacoes: [transacao({ tipo: 'DESPESA', categoria: 'COMPRA_GADO', valor: 100000 })],
    });
    expect(r.custoPorCabecaViva).toBe(0);
    expect(r.arrobasRestantes).toBe(0);
    expect(r.pontoEquilibrio).toBe(0);
    expect(r.lucroProjetado).toBe(0);
  });

  it('sem cabeças no lote: lucroPorCabeca não divide por zero', () => {
    const r = calcularDRE({ ...base, qtdCabecas: 0, cabecasVivas: 0 });
    expect(r.lucroPorCabeca).toBe(0);
  });
});
