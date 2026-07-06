import { supabase, supabaseReady } from './supabase';

export type MercadoPagoPlan = 'annual' | 'lifetime';

/**
 * Cria o checkout do Mercado Pago para o usuário logado (edge function
 * mp-create-checkout, que grava user_id na preferência) e devolve a URL de
 * pagamento. Lança erro com mensagem amigável quando indisponível.
 */
export async function iniciarCheckout(plan: MercadoPagoPlan): Promise<string> {
  if (!supabaseReady) throw new Error('Checkout indisponível no modo preview.');

  const { data, error } = await supabase.functions.invoke('mp-create-checkout', {
    body: { plan },
  });
  if (error) {
    throw new Error('Não foi possível iniciar o pagamento. Tente novamente em instantes.');
  }
  const url = (data as { init_point?: string } | null)?.init_point;
  if (!url) throw new Error('Resposta de pagamento inválida. Tente novamente.');
  return url;
}
