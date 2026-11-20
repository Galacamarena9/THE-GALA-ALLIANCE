'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/app/actions/auth';

/**
 * Prompt 13 · Ofertas de marca. Todo pasa por funciones de la base de datos: la marca envía una oferta
 * inmutable, solo el atleta la acepta, las entregas se versionan y el pago lo confirma el atleta.
 */
const num = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().min(0).max(10_000_000).optional());
const int = (min: number, max: number, d: number) => z.preprocess((v) => (v === '' || v == null ? d : Number(v)), z.number().int().min(min).max(max));

const offerSchema = z.object({
  application_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  cash_amount: num, cash_currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  product_description: z.string().trim().max(500).optional(), product_value: num,
  bonus_amount: num, bonus_description: z.string().trim().max(500).optional(),
  unknown: z.literal('on').optional(),
  deliverable_kind: z.enum(['reel', 'story', 'post', 'video', 'appearance', 'event', 'photo_shoot', 'other']),
  deliverable_platform: z.string().trim().max(60).optional(),
  deliverable_quantity: int(1, 100, 1),
  deliverable_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  deliverable_description: z.string().trim().min(3, 'Describe el entregable').max(1000),
  usage_months: int(0, 60, 0),
  usage_channels: z.string().trim().max(200).optional(),
  paid_media: z.literal('on').optional(),
  exclusivity_category: z.string().trim().max(120).optional(),
  exclusivity_days: int(0, 730, 0),
  expires_days: int(1, 60, 14),
  terms: z.string().trim().max(4000).optional(),
});

const ERR: Record<string, string> = {
  athlete_not_selected: 'Primero selecciona al atleta.',
  brand_not_verified: 'Tu marca tiene que estar verificada para enviar ofertas.',
  compensation_required: 'Indica la compensación o marca «No especificada».',
  deliverables_required: 'Añade al menos un entregable.',
  campaign_offer_exclusivity: 'Si hay exclusividad, indica la categoría de competidores.',
  campaigns_adults_only: 'Las colaboraciones con marcas son solo para mayores de edad.',
};
const friendly = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? 'No se ha podido completar la acción.';

export async function sendBrandOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['brand']);
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los campos.' };
  const d = parsed.data;
  const components: Record<string, unknown>[] = [];
  if (d.cash_amount) components.push({ kind: 'cash', amount: d.cash_amount, currency: d.cash_currency, guaranteed: true, description: 'Pago fijo' });
  if (d.product_description) components.push({ kind: 'product', amount: d.product_value ?? null, currency: d.cash_currency, guaranteed: true, description: d.product_description });
  if (d.bonus_amount && d.bonus_description) components.push({ kind: 'performance_bonus', amount: d.bonus_amount, currency: d.cash_currency, guaranteed: false, description: d.bonus_description });
  const supabase = await createClient();
  const { error } = await supabase.rpc('campaign_offer_send', {
    p_application: d.application_id,
    p_components: components,
    p_deliverables: [{ kind: d.deliverable_kind, platform: d.deliverable_platform || null, quantity: d.deliverable_quantity, due_date: d.deliverable_due || null, description: d.deliverable_description }],
    p_usage_months: d.usage_months,
    p_usage_channels: (d.usage_channels ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 10),
    p_paid_media: d.paid_media === 'on',
    p_exclusivity_category: d.exclusivity_category || null,
    p_exclusivity_days: d.exclusivity_days,
    p_expires_days: d.expires_days,
    p_terms: d.terms || null,
    p_compensation_unknown: d.unknown === 'on' && components.length === 0,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/app/campaigns/${d.campaign_id}`);
  return { ok: true, message: 'Oferta enviada. El atleta ve cada condición antes de decidir.' };
}

const idOnly = z.object({ id: z.string().uuid() });

export async function respondBrandOffer(formData: FormData) {
  await requireSession(['athlete']);
  const p = idOnly.extend({ accept: z.enum(['yes', 'no']), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.rpc('campaign_offer_respond', { p_offer: p.data.id, p_accept: p.data.accept === 'yes', p_reason: p.data.reason || null });
  revalidatePath('/app/collaborations');
}

export async function withdrawBrandOffer(formData: FormData) {
  await requireSession(['brand']);
  const p = idOnly.extend({ campaign_id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.rpc('campaign_offer_withdraw', { p_offer: p.data.id });
  revalidatePath(`/app/campaigns/${p.data.campaign_id}`);
}

export async function submitDeliverable(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['athlete']);
  const p = idOnly.extend({ url: z.string().trim().max(500).regex(/^https:\/\/\S+$/, 'El enlace debe empezar por https://'), note: z.string().trim().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Enlace no válido.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('campaign_deliverable_submit', { p_deliverable: p.data.id, p_url: p.data.url, p_note: p.data.note || null });
  if (error) return { error: error.message.includes('deliverable_closed') ? 'Este entregable ya está cerrado.' : 'No se ha podido enviar.' };
  revalidatePath('/app/collaborations');
  return { ok: true, message: `Versión ${data} enviada a la marca.` };
}

export async function reviewDeliverable(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['brand']);
  const p = idOnly.extend({ campaign_id: z.string().uuid(), decision: z.enum(['approve', 'changes']), feedback: z.string().trim().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('campaign_deliverable_review', { p_deliverable: p.data.id, p_approve: p.data.decision === 'approve', p_feedback: p.data.feedback || null });
  if (error) return { error: error.message.includes('feedback_required') ? 'Explica qué cambio necesitas (mínimo 10 caracteres).' : 'No se ha podido guardar la revisión.' };
  revalidatePath(`/app/campaigns/${p.data.campaign_id}`);
  return { ok: true, message: p.data.decision === 'approve' ? 'Entregable aprobado.' : 'Cambios pedidos al atleta.' };
}

export async function updateBrandPayment(formData: FormData) {
  await requireSession(['athlete', 'brand']);
  const p = idOnly.extend({ status: z.enum(['paid_declared', 'confirmed', 'disputed']), campaign_id: z.string().uuid().optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.rpc('campaign_payment_update', { p_offer: p.data.id, p_status: p.data.status });
  revalidatePath('/app/collaborations');
  if (p.data.campaign_id) revalidatePath(`/app/campaigns/${p.data.campaign_id}`);
}
