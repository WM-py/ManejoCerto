import { createClient } from '@supabase/supabase-js';
import { createMockClient } from './mockSupabase';

// MODO PREVIEW: usa um backend simulado em memória (dados fictícios).
// Descartável — para remover, apague este bloco + mockSupabase.ts + mockData.ts.
const usePreviewMock = import.meta.env.VITE_PREVIEW_MOCK === 'true';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseConfigValid = usePreviewMock || (!!supabaseUrl && !!supabaseAnonKey);

if (!supabaseConfigValid) {
  console.error(
    'Missing Supabase environment variables. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel or .env.'
  );
}

export const supabase = usePreviewMock
  ? (createMockClient() as unknown as ReturnType<typeof createClient>)
  : createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

export const supabaseReady = supabaseConfigValid;

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

// Storage: bucket privado de comprovantes (nota fiscal / recibo)
export const COMPROVANTES_BUCKET = 'comprovantes';

// Faz upload do comprovante e retorna o path salvo (ou null em erro).
export async function uploadComprovante(userId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(COMPROVANTES_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return null;
  return path;
}

// Gera uma URL assinada temporária para visualizar o comprovante.
export async function getComprovanteUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(COMPROVANTES_BUCKET).createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}

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