export type MercadoPagoPlan = 'annual' | 'lifetime';

const annualPreferenceId = import.meta.env.VITE_MP_ANNUAL_PREFERENCE_ID;
const lifetimePreferenceId = import.meta.env.VITE_MP_LIFETIME_PREFERENCE_ID;
const checkoutBase = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=';

export function getMercadoPagoPreferenceUrl(plan: MercadoPagoPlan): string | null {
  const preferenceId = plan === 'annual' ? annualPreferenceId : lifetimePreferenceId;
  return preferenceId ? `${checkoutBase}${preferenceId}` : null;
}

export function hasMercadoPagoConfigured(): boolean {
  return Boolean(annualPreferenceId || lifetimePreferenceId);
}
