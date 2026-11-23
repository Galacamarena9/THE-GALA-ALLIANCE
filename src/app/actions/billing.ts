'use server';

import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';

/**
 * 15 · Suscripciones de organizaciones con Stripe. El navegador nunca toca claves ni decide el estado:
 * aquí solo se crean el cliente y la sesión de pago; el estado real lo escribe el webhook firmado.
 * Sin STRIPE_SECRET_KEY o sin precio en el catálogo, se dice con claridad que aún no está disponible.
 */
const STRIPE = 'https://api.stripe.com/v1';

async function stripe(path: string, key: string, body: URLSearchParams, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  // Reintentos seguros: si la misma creación se repite, Stripe devuelve el mismo objeto en vez de duplicarlo.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${STRIPE}${path}`, { method: 'POST', headers, body, cache: 'no-store' });
  return (await res.json()) as { id?: string; url?: string; error?: { message: string } };
}

interface CatalogPlan { code: string; name: string; stripe_price_id: string | null; price_cents: number | null; currency: string | null; billing_interval: string }

/** Línea de la sesión de pago: el precio guardado en Stripe si existe; si no, uno recurrente creado desde el catálogo. */
function linePrice(plan: CatalogPlan): Record<string, string> {
  if (plan.stripe_price_id) return { 'line_items[0][price]': plan.stripe_price_id };
  return {
    'line_items[0][price_data][currency]': (plan.currency ?? 'EUR').toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(plan.price_cents),
    'line_items[0][price_data][recurring][interval]': plan.billing_interval,
    'line_items[0][price_data][product_data][name]': `The Gala Alliance · ${plan.name}`,
  };
}

async function ensureCustomer(orgId: string, key: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: accountId, error } = await supabase.rpc('billing_account_ensure', { p_org: orgId });
  if (error || !accountId) return null;
  const { data: acct } = await supabase.from('billing_accounts').select('stripe_customer_id').eq('id', accountId).maybeSingle();
  if (acct?.stripe_customer_id) return acct.stripe_customer_id as string;
  // Comprobar el servidor ANTES de crear nada en Stripe: así no quedan clientes huérfanos.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const customer = await stripe('/customers', key, new URLSearchParams({ name: (org?.name as string) ?? 'Organización', 'metadata[billing_account_id]': String(accountId), 'metadata[organization_id]': orgId }), `customer-${accountId}`);
  if (!customer.id) return null;
  const admin = createServiceClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  await admin.rpc('billing_set_customer', { p_account: accountId, p_customer: customer.id });
  return customer.id;
}

export async function startSubscription(formData: FormData) {
  await requireSession(['agent', 'coach', 'university', 'brand']);
  const p = z.object({ org_id: z.string().uuid(), plan_code: z.string().regex(/^[a-z_]+$/) }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect('/app/billing?estado=error');
  const key = process.env.STRIPE_SECRET_KEY;
  const supabase = await createClient();
  const { data: plan } = await supabase.from('plan_catalog').select('code, name, audience, stripe_price_id, price_cents, currency, billing_interval')
    .eq('code', p.data.plan_code).eq('active', true).order('version', { ascending: false }).limit(1).maybeSingle();
  const cents = plan?.price_cents as number | null | undefined;
  if (!key || !plan || !['month', 'year'].includes(plan.billing_interval as string) || (!plan.stripe_price_id && !(cents && cents > 0))) redirect('/app/billing?estado=no_disponible');
  const customer = await ensureCustomer(p.data.org_id, key);
  if (!customer) redirect('/app/billing?estado=no_permitido');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const session = await stripe('/checkout/sessions', key, new URLSearchParams({
    mode: 'subscription', customer,
    // Precio por plan (no por asiento): cantidad 1. Sin precio guardado en Stripe, se crea al vuelo desde el catálogo.
    ...linePrice(plan as unknown as CatalogPlan),
    'line_items[0][quantity]': '1',
    // Agencias: 30 días de prueba; no se cobra nada hasta que acaba.
    ...(plan.audience === 'agent' ? { 'subscription_data[trial_period_days]': '30' } : {}),
    'subscription_data[metadata][plan_code]': plan.code as string,
    'subscription_data[metadata][organization_id]': p.data.org_id,
    'tax_id_collection[enabled]': 'true', 'automatic_tax[enabled]': 'true',
    // Con un cliente ya creado, Stripe necesita poder guardar nombre fiscal y dirección que se escriban en el pago.
    'customer_update[name]': 'auto', 'customer_update[address]': 'auto',
    success_url: `${site}/app/billing?estado=ok`, cancel_url: `${site}/app/billing?estado=cancelado`, locale: 'es',
  }));
  redirect(session.url ?? '/app/billing?estado=error');
}

/** Portal de Stripe: cambiar tarjeta, descargar facturas, cancelar. Cancelar es tan fácil como contratar. */
export async function openBillingPortal(formData: FormData) {
  await requireSession(['agent', 'coach', 'university', 'brand']);
  const orgId = z.string().uuid().safeParse(formData.get('org_id'));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!orgId.success || !key) redirect('/app/billing?estado=no_disponible');
  const customer = await ensureCustomer(orgId.data, key);
  if (!customer) redirect('/app/billing?estado=no_permitido');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const portal = await stripe('/billing_portal/sessions', key, new URLSearchParams({ customer, return_url: `${site}/app/billing` }));
  redirect(portal.url ?? '/app/billing?estado=error');
}

export async function assignSeat(formData: FormData) {
  await requireSession(['agent', 'coach', 'university', 'brand']);
  const p = z.object({ subscription_id: z.string().uuid(), user_id: z.string().uuid(), assign: z.enum(['yes', 'no']) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('seat_assign', { p_subscription: p.data.subscription_id, p_user: p.data.user_id, p_assign: p.data.assign === 'yes' });
  redirect(`/app/billing?estado=${error ? (error.message.includes('no_seats_left') ? 'sin_asientos' : 'error') : 'asientos'}`);
}
