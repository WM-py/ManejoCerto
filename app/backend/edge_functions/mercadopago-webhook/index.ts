/**
 * Supabase Edge Function (Deno) — Mercado Pago webhook handler
 * - Recebe notificações do Mercado Pago
 * - Busca o pagamento na API do Mercado Pago para validar status
 * - Mapeia para um usuário (payment.metadata.user_id ou payer.email)
 * - Atualiza a tabela de perfis (`plan`, `plan_status`, `trial_end`)
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - MERCADO_PAGO_ACCESS_TOKEN
 * - (optional) SUPABASE_PROFILES_TABLE (defaults to app_34b6ab49dc_profiles)
 */

import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MP_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') || '';
const PROFILES_TABLE = Deno.env.get('SUPABASE_PROFILES_TABLE') || 'app_34b6ab49dc_profiles';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MP_TOKEN) {
  console.error('Missing required environment variables for mercadopago-webhook');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  try {
    const body = await req.json().catch(() => ({}));

    // Attempt to extract payment id from common webhook shapes
    const paymentId = body?.data?.id || body?.id || body?.resource?.id;
    if (!paymentId) return new Response('no payment id', { status: 400 });

    // Fetch payment from Mercado Pago to validate status
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!mpRes.ok) {
      console.error('Failed to fetch payment from Mercado Pago', mpRes.status);
      return new Response('mp fetch failed', { status: 502 });
    }
    const payment = await mpRes.json();

    const status = (payment?.status || '').toString().toLowerCase();
    if (status !== 'approved' && status !== 'paid') {
      // Not a successful payment — ignore
      return new Response('payment not approved', { status: 200 });
    }

    // Try to resolve the Supabase user id
    let userId: string | undefined = payment?.metadata?.user_id || payment?.external_reference || payment?.metadata?.external_reference;

    // Fallback: try payer email -> lookup user in auth.users
    if (!userId && payment?.payer?.email) {
      const payerEmail = payment.payer.email;
      const { data: userRecord, error: listErr } = await supabase.from('users').select('id').eq('email', payerEmail).maybeSingle();
      if (listErr) console.error('error finding user by email', listErr);
      userId = (userRecord as any)?.id;
    }

    if (!userId) {
      console.error('Could not map payment to a user', { paymentId, payment });
      return new Response('no user mapping found', { status: 200 });
    }

    // Decide plan type: try preference / items info
    let plan = 'annual';
    try {
      const prefId = payment.preference_id || '';
      const lifetimePref = Deno.env.get('VITE_MP_LIFETIME_PREFERENCE_ID') || Deno.env.get('MERCADO_PAGO_LIFETIME_PREFERENCE_ID');
      if (prefId && lifetimePref && prefId === lifetimePref) plan = 'lifetime';
      // also check item titles
      const items = payment?.additional_info?.items || payment?.items || [];
      if (Array.isArray(items) && items[0]?.title && String(items[0].title).toLowerCase().includes('vital')) plan = 'lifetime';
    } catch (e) {
      // ignore
    }

    const updates: Record<string, unknown> = { plan, plan_status: 'active', trial_end: null };

    const { error: updateErr } = await supabase.from(PROFILES_TABLE).update(updates).eq('id', userId);
    if (updateErr) {
      console.error('error updating profile', updateErr);
      return new Response('db update error', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('mercadopago-webhook error', err);
    return new Response('error', { status: 500 });
  }
});
