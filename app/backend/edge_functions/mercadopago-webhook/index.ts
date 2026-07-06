/**
 * Supabase Edge Function (Deno) — Mercado Pago webhook handler
 *
 * Recebe notificações de pagamento do Mercado Pago, valida o pagamento na API
 * oficial (fonte de verdade — não confia no corpo da notificação) e ativa o
 * plano do usuário. O vínculo pagamento→usuário vem do `external_reference` /
 * `metadata.user_id` gravados pela function `mp-create-checkout` ao criar a
 * preferência.
 *
 * Deploy com verify_jwt=false: o Mercado Pago não envia JWT. A segurança vem
 * de buscar o pagamento na API do MP com o nosso access token — uma notificação
 * forjada precisaria de um payment id real, aprovado, da nossa conta.
 *
 * Env (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pela plataforma):
 * - MERCADO_PAGO_ACCESS_TOKEN
 * - (opcional) SUPABASE_PROFILES_TABLE (padrão app_34b6ab49dc_profiles)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MP_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? '';
const PROFILES_TABLE = Deno.env.get('SUPABASE_PROFILES_TABLE') ?? 'app_34b6ab49dc_profiles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req: Request) => {
  // MP só notifica via POST; GET/HEAD respondem 200 para health checks.
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  if (!MP_TOKEN) {
    console.error('MERCADO_PAGO_ACCESS_TOKEN ausente');
    return new Response('not configured', { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // A notificação chega em formatos diferentes (webhook novo, IPN legado).
    const kind = (
      url.searchParams.get('type') ??
      url.searchParams.get('topic') ??
      (body as { type?: string; topic?: string; action?: string }).type ??
      (body as { topic?: string }).topic ??
      (body as { action?: string }).action ??
      ''
    ).toString();

    const paymentId =
      url.searchParams.get('data.id') ??
      url.searchParams.get('id') ??
      (body as { data?: { id?: string | number } }).data?.id ??
      (body as { id?: string | number }).id;

    // Só nos interessam eventos de pagamento (merchant_order etc. são ignorados).
    if (!kind.includes('payment') || !paymentId) {
      return new Response('ignored', { status: 200 });
    }

    // Fonte de verdade: busca o pagamento na API do Mercado Pago.
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error('Falha ao buscar pagamento no MP', paymentId, mpRes.status);
      // 5xx faz o MP reenviar a notificação mais tarde.
      return new Response('mp fetch failed', { status: 502 });
    }
    const payment = await mpRes.json();

    const status = String(payment?.status ?? '').toLowerCase();
    if (status !== 'approved') {
      return new Response('payment not approved', { status: 200 });
    }

    // Vínculo com o usuário: metadata.user_id ou external_reference (uuid).
    const candidate = String(
      payment?.metadata?.user_id ?? payment?.external_reference ?? ''
    );
    if (!UUID_RE.test(candidate)) {
      console.error('Pagamento aprovado sem user_id mapeável', {
        paymentId,
        external_reference: payment?.external_reference,
        metadata: payment?.metadata,
        payer_email: payment?.payer?.email,
      });
      // 200: reenviar não resolve; o caso fica no log para conciliação manual.
      return new Response('no user mapping', { status: 200 });
    }
    const userId = candidate;

    // Plano: metadata.plan da preferência; título do item como fallback.
    let plan: 'annual' | 'lifetime' = 'annual';
    const metaPlan = String(payment?.metadata?.plan ?? '').toLowerCase();
    if (metaPlan === 'lifetime') plan = 'lifetime';
    else if (metaPlan !== 'annual') {
      const items = payment?.additional_info?.items ?? [];
      if (Array.isArray(items) && items[0]?.title && /vital/i.test(String(items[0].title))) {
        plan = 'lifetime';
      }
    }

    const { error } = await supabase
      .from(PROFILES_TABLE)
      .update({ plan, plan_status: 'active', trial_end: null })
      .eq('id', userId);
    if (error) {
      console.error('Erro ao ativar plano no perfil', userId, error);
      return new Response('db update error', { status: 500 });
    }

    console.log('Plano ativado', { userId, plan, paymentId });
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('mercadopago-webhook error', err);
    return new Response('error', { status: 500 });
  }
});
