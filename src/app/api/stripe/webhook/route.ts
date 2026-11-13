import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { planByCode } from '@/content/plans';

/**
 * Webhook de Stripe: concede el plan automáticamente al confirmarse el pago y lo retira si se reembolsa.
 * Única pieza del servidor que usa la clave secreta de Supabase (SUPABASE_SECRET_KEY): nunca llega al navegador.
 * Idempotente: la referencia (id de la sesión de pago) es única por origen, así que un reintento de Stripe no duplica.
 */
export const runtime = 'nodejs';

const TOLERANCE_SECONDS = 300;

function verifySignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest();
  return v1.some((sig) => {
    const got = Buffer.from(sig, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !url || !serviceKey) return new Response('not configured', { status: 503 });

  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get('stripe-signature'), secret)) return new Response('bad signature', { status: 400 });

  const event = JSON.parse(payload) as StripeEvent;
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as { id: string; payment_status?: string; metadata?: Record<string, string>; client_reference_id?: string };
    const userId = s.metadata?.user_id ?? s.client_reference_id;
    const plan = planByCode(s.metadata?.plan_code ?? '');
    if (s.payment_status !== 'paid' || !userId || !plan || plan.cta !== 'checkout') return Response.json({ ignored: true });

    // El plan es familiar: se concede a quien paga y a los atletas que tiene vinculados y aprobados.
    const { data: links } = await db.from('parent_athlete_links').select('athlete_id').eq('parent_id', userId).eq('status', 'approved');
    const users = [userId, ...(links ?? []).map((l) => l.athlete_id as string)];
    const rows = users.map((u) => ({ user_id: u, plan_code: plan.code, source: 'stripe', reference: u === userId ? s.id : `${s.id}:${u}` }));
    const { error } = await db.from('entitlements').upsert(rows, { onConflict: 'source,reference', ignoreDuplicates: true });
    if (error) return new Response('db error', { status: 500 }); // Stripe reintentará.
    await db.from('audit_logs').insert({ actor_id: null, action: 'entitlement.granted', entity: 'entitlements', details: { plan: plan.code, checkout: s.id, users: users.length } });
    await db.from('notifications').insert(users.map((u) => ({ user_id: u, kind: 'system', title: `Plan ${plan.name} activado`, body: 'Ya tienes acceso a todo lo incluido. Empieza en Mi plan.', link: '/app/plan' })));
    return Response.json({ granted: users.length });
  }

  if (event.type === 'charge.refunded') {
    const c = event.data.object as { refunded?: boolean; metadata?: Record<string, string>; payment_intent?: string };
    if (!c.refunded || !c.payment_intent) return Response.json({ ignored: true });
    // Buscamos la sesión de pago asociada para retirar el plan concedido con esa referencia.
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return Response.json({ ignored: true });
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(c.payment_intent)}&limit=1`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    });
    const list = (await res.json()) as { data?: { id: string }[] };
    const sessionId = list.data?.[0]?.id;
    if (!sessionId) return Response.json({ ignored: true });
    await db.from('entitlements').update({ revoked_at: new Date().toISOString() }).eq('source', 'stripe').or(`reference.eq.${sessionId},reference.like.${sessionId}:%`);
    await db.from('audit_logs').insert({ actor_id: null, action: 'entitlement.revoked', entity: 'entitlements', details: { checkout: sessionId, reason: 'refund' } });
    return Response.json({ revoked: true });
  }

  return Response.json({ ignored: true });
}
