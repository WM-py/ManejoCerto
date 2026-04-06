import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table names with session prefix
export const TABLES = {
  profiles: 'app_34b6ab49dc_profiles',
  lotes: 'app_34b6ab49dc_lotes',
  transacoes: 'app_34b6ab49dc_transacoes',
  compras_vendas: 'app_34b6ab49dc_compras_vendas',
  pesagens: 'app_34b6ab49dc_pesagens',
  parametros_fazenda: 'app_34b6ab49dc_parametros_fazenda',
  pastos: 'app_34b6ab49dc_pastos',
  baixas: 'app_34b6ab49dc_baixas',
  pesagens_lote: 'app_34b6ab49dc_pesagens_lote',
} as const;

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