/**
 * Supabase Edge Function (Deno) — cria o checkout do Mercado Pago
 *
 * Chamada pelo app (usuário logado) via supabase.functions.invoke. Cria uma
 * preferência de pagamento POR USUÁRIO com `external_reference = user_id` e
 * `metadata = { user_id, plan }` — é isso que permite ao webhook ativar o
 * plano certo mesmo que o pagador use outro e-mail no Mercado Pago.
 *
 * Deploy com verify_jwt=true: só aceita chamadas autenticadas do app.
 *
 * Env (SUPABASE_URL e SUPABASE_ANON_KEY são injetados pela plataforma):
 * - MERCADO_PAGO_ACCESS_TOKEN
 * - (opcional) APP_BASE_URL (padrão https://manejo-certo.vercel.app)
 * - (opcional) MP_PRICE_ANNUAL / MP_PRICE_LIFETIME (padrão 497 / 997)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MP_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? '';
const APP_URL = (Deno.env.get('APP_BASE_URL') ?? 'https://manejo-certo.vercel.app').replace(/\/$/, '');
const PRICE_ANNUAL = Number(Deno.env.get('MP_PRICE_ANNUAL') ?? '497');
const PRICE_LIFETIME = Number(Deno.env.get('MP_PRICE_LIFETIME') ?? '997');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!MP_TOKEN) {
    console.error('MERCADO_PAGO_ACCESS_TOKEN ausente');
    return json({ error: 'Checkout indisponível no momento.' }, 503);
  }

  try {
    // Identifica o usuário pelo JWT repassado pelo cliente.
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Não autenticado.' }, 401);

    const { plan } = await req.json().catch(() => ({ plan: undefined }));
    if (plan !== 'annual' && plan !== 'lifetime') {
      return json({ error: 'Plano inválido.' }, 400);
    }

    const isAnnual = plan === 'annual';
    const preference = {
      items: [
        {
          id: `manejo-certo-${plan}`,
          title: isAnnual ? 'Manejo Certo — Plano Anual' : 'Manejo Certo — Plano Vitalício',
          description: isAnnual
            ? 'Assinatura anual do Manejo Certo (12 meses de acesso).'
            : 'Acesso vitalício ao Manejo Certo (oferta de lançamento).',
          quantity: 1,
          unit_price: isAnnual ? PRICE_ANNUAL : PRICE_LIFETIME,
          currency_id: 'BRL',
        },
      ],
      external_reference: user.id,
      metadata: { user_id: user.id, plan },
      payer: user.email ? { email: user.email } : undefined,
      back_urls: {
        success: `${APP_URL}/?pagamento=sucesso`,
        pending: `${APP_URL}/?pagamento=pendente`,
        failure: `${APP_URL}/assinar?pagamento=falhou`,
      },
      auto_return: 'approved',
      statement_descriptor: 'MANEJOCERTO',
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    });
    if (!mpRes.ok) {
      console.error('Falha ao criar preferência no MP', mpRes.status, await mpRes.text());
      return json({ error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, 502);
    }
    const pref = await mpRes.json();

    console.log('Preferência criada', { userId: user.id, plan, prefId: pref?.id });
    return json({ id: pref?.id, init_point: pref?.init_point });
  } catch (err) {
    console.error('mp-create-checkout error', err);
    return json({ error: 'Erro interno ao iniciar o pagamento.' }, 500);
  }
});
