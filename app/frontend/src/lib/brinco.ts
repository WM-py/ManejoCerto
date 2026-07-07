// Helpers de brinco — extraídos de EtiquetarLoteSheet.tsx para serem testáveis isoladamente.

/** Incrementa o sufixo numérico de um brinco, preservando prefixo e zeros à esquerda (ex: "BR0099" -> "BR0100"). */
export function proximoBrinco(brinco: string): string | null {
  const m = brinco.match(/^(\D*)(\d+)$/);
  if (!m) return null;
  const [, prefixo, digitos] = m;
  const proximo = (BigInt(digitos) + 1n).toString().padStart(digitos.length, '0');
  return prefixo + proximo;
}
