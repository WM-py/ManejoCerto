import { describe, it, expect } from 'vitest';
import { kgToArrobas, formatBRL, maskBRLInput, parseBRLInput, daysBetween } from './format';

describe('kgToArrobas', () => {
  it('converte kg para arrobas (1 @ = 30 kg)', () => {
    expect(kgToArrobas(30)).toBe(1);
    expect(kgToArrobas(450)).toBe(15);
  });

  it('aceita zero', () => {
    expect(kgToArrobas(0)).toBe(0);
  });
});

describe('formatBRL', () => {
  it('formata valores positivos em R$ pt-BR', () => {
    expect(formatBRL(1500)).toBe('R$ 1.500,00');
  });

  it('formata zero e negativos', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(-50)).toBe('-R$ 50,00');
  });
});

describe('maskBRLInput / parseBRLInput', () => {
  it('constrói o valor em centavos conforme o usuário digita', () => {
    expect(maskBRLInput('1')).toBe('0,01');
    expect(maskBRLInput('150000')).toBe('1.500,00');
  });

  it('ignora caracteres não numéricos e zeros à esquerda', () => {
    expect(maskBRLInput('R$ 001500')).toBe('15,00');
  });

  it('retorna string vazia quando não há dígitos', () => {
    expect(maskBRLInput('')).toBe('');
    expect(maskBRLInput('abc')).toBe('');
  });

  it('parseBRLInput é o inverso de maskBRLInput para valores em reais', () => {
    expect(parseBRLInput('1.500,00')).toBe(1500);
    expect(parseBRLInput('')).toBe(0);
  });
});

describe('daysBetween', () => {
  it('calcula dias entre duas datas, independente da ordem', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(10);
  });

  it('retorna 0 para a mesma data', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});
