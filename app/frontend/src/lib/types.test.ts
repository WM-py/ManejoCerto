import { describe, it, expect } from 'vitest';
import { calcularCategoria } from './types';

describe('calcularCategoria', () => {
  it('lote misto sempre cai em "Lote Misto", independente do peso', () => {
    expect(calcularCategoria('Misto', 100)).toBe('Lote Misto');
    expect(calcularCategoria('Misto', 500)).toBe('Lote Misto');
  });

  it('machos: Bezerros <= 210kg, Garrotes <= 360kg, senão Bois', () => {
    expect(calcularCategoria('Macho', 210)).toBe('Bezerros');
    expect(calcularCategoria('Macho', 211)).toBe('Garrotes');
    expect(calcularCategoria('Macho', 360)).toBe('Garrotes');
    expect(calcularCategoria('Macho', 361)).toBe('Bois');
  });

  it('fêmeas: Bezerras <= 210kg, Novilhas <= 300kg, senão Vacas', () => {
    expect(calcularCategoria('Fêmea', 210)).toBe('Bezerras');
    expect(calcularCategoria('Fêmea', 211)).toBe('Novilhas');
    expect(calcularCategoria('Fêmea', 300)).toBe('Novilhas');
    expect(calcularCategoria('Fêmea', 301)).toBe('Vacas');
  });

  it('peso zero (lote recém-criado, sem pesagem) fica na menor categoria', () => {
    expect(calcularCategoria('Macho', 0)).toBe('Bezerros');
    expect(calcularCategoria('Fêmea', 0)).toBe('Bezerras');
  });
});
