import { describe, it, expect } from 'vitest';
import { proximoBrinco } from './brinco';

describe('proximoBrinco', () => {
  it('incrementa brinco puramente numérico', () => {
    expect(proximoBrinco('4478')).toBe('4479');
  });

  it('preserva zeros à esquerda', () => {
    expect(proximoBrinco('0099')).toBe('0100');
    expect(proximoBrinco('009')).toBe('010');
  });

  it('preserva prefixo não numérico', () => {
    expect(proximoBrinco('BR0099')).toBe('BR0100');
  });

  it('retorna null quando não há dígitos no final', () => {
    expect(proximoBrinco('abc')).toBeNull();
    expect(proximoBrinco('')).toBeNull();
  });

  it('lida com rollover de 9 para 10 sem perder o dígito extra', () => {
    expect(proximoBrinco('9')).toBe('10');
    expect(proximoBrinco('99')).toBe('100');
  });
});
