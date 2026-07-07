// Helpers puros de formatação/conversão — sem dependência do client Supabase,
// para poderem ser testados isoladamente.

// Helper: convert KG to Arrobas (@ = kg / 30)
export function kgToArrobas(kg: number): number {
  return kg / 30;
}

// Helper: format currency BRL
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Helper: máscara de moeda para input (usuário digita e vê "1.500,00").
// Trabalha em centavos: cada dígito digitado empurra o valor.
export function maskBRLInput(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  const n = Number(digits) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper: converte a string mascarada ("1.500,00") de volta para número (1500).
export function parseBRLInput(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

// Helper: format date
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

// Helper: calculate days between two dates
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diff = Math.abs(b.getTime() - a.getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
