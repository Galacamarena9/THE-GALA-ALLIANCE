'use server';

import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { REQUIRED_MATERIAL_LABEL, validatePublish } from '@/lib/domain/recruit';
import { TRIAL_TYPES } from '@/lib/domain/trials';

const optDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null);
const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
/** Trial / programa: coste explícito y fechas coherentes (la base de datos repite estas reglas). */
const eventSchema = z.object({
  ev_start: optDate, ev_end: optDate,
  ev_time: z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)]).optional().transform((v) => v || null),
  ev_tz: z.string().trim().regex(/^([A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}|UTC)$/, 'Zona horaria no válida (ej.: Europe/Madrid)').optional().or(z.literal('')).transform((v) => v || null),
  ev_country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Código de país de 2 letras').optional().or(z.literal('')).transform((v) => v || null),
  ev_city: optStr(80), ev_venue: optStr(120), ev_cat: optStr(40),
  ev_fee: z.enum(['free', 'paid', 'unknown']).default('unknown'),
  ev_amount: z.union([z.literal(''), z.coerce.number().min(0).max(1000000)]).optional().transform((v) => (v === '' || v == null ? null : v)),
  ev_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda ISO (EUR, USD…)').optional().or(z.literal('')).transform((v) => v || null),
  ev_refund: z.enum(['yes', 'no', 'partial', 'unknown']).default('unknown'),
  ev_acc: z.enum(['included', 'available_paid', 'not_included', 'unknown']).default('unknown'),
  ev_meals: z.enum(['included', 'not_included', 'unknown']).default('unknown'),
  ev_travel: z.enum(['included', 'not_included', 'unknown']).default('unknown'),
  ev_minor: z.enum(['guardian_consent_required', 'adults_only']).default('guardian_consent_required'),
}).superRefine((e, ctx) => {
  if (e.ev_fee === 'paid' && e.ev_amount == null) ctx.addIssue({ code: 'custom', path: ['ev_amount'], message: 'Indica el importe: un trial de pago siempre muestra su coste.' });
  if (e.ev_fee === 'paid' && !e.ev_currency) ctx.addIssue({ code: 'custom', path: ['ev_currency'], message: 'Indica la moneda.' });
  if (e.ev_start && e.ev_end && e.ev_end < e.ev_start) ctx.addIssue({ code: 'custom', path: ['ev_end'], message: 'La fecha de fin es anterior al inicio.' });
});
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const optInt = (min: number, max: number) =>
  z.union([z.literal(''), z.coerce.number().int().min(min).max(max)]).optional().transform((v) => (v === '' || v == null ? null : v));
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const oppSchema = z
  .object({
    organization_id: z.string().uuid(),
    type: z.enum(['athletic_scholarship', 'university_recruitment', 'club_recruitment', 'academy', 'tryout', 'camp_showcase']),
    title: z.string().trim().min(4, 'Mínimo 4 caracteres').max(160),
    description: z.string().trim().min(20, 'Describe la oportunidad (mín. 20 caracteres)').max(5000),
    sport_id: z.string().min(1),
    division: z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', '']).optional().transform((v) => v || null),
    min_gpa_4: z.union([z.literal(''), z.coerce.number().min(0).max(4)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    english_required: optText(120),
    location: optText(160),
    start_term: optText(60),
    deadline: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
    places: optInt(1, 500),
    annual_cost_usd: optInt(0, 200000),
    aid_amount_usd: optInt(0, 200000),
    aid_kind: z.enum(['full', 'partial', 'unknown']).default('unknown'),
    // Fase 07: beca honesta, requisitos visibles y caducidad.
    scholarship_status: z.enum(['not_provided', 'potentially_available', 'amount_stated']).default('not_provided'),
    international_eligible: z.enum(['yes', 'no', 'unknown']).default('unknown'),
    contact_method: z.enum(['gala', 'application_only']).default('gala'),
    expires_at: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
    need_id: z.union([z.literal(''), z.string().uuid()]).optional().transform((v) => v || null),
    submit: z.enum(['draft', 'review']),
  })
  .refine((d) => d.aid_amount_usd == null || d.annual_cost_usd == null || d.aid_amount_usd <= d.annual_cost_usd, {
    message: 'La ayuda no puede superar el coste',
    path: ['aid_amount_usd'],
  });

export async function createOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['university', 'coach']);
  const parsed = oppSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { fieldErrors: fe, error: 'Revisa los campos marcados.' };
  }
  const positionIds = z.coerce.number().int().positive().array().safeParse(formData.getAll('position_ids'));
  const gradYears = z.coerce.number().int().min(2024).max(2040).array().safeParse(formData.getAll('graduation_years'));
  if (!positionIds.success || !gradYears.success) return { error: 'Posiciones o años no válidos.' };

  const materials = z.enum(Object.keys(REQUIRED_MATERIAL_LABEL) as [string, ...string[]]).array().max(10).safeParse(formData.getAll('required_materials'));
  if (!materials.success) return { error: 'Materiales no válidos.' };
  const honesty = validatePublish(parsed.data);
  if (Object.keys(honesty).length) return { fieldErrors: honesty, error: 'Revisa los campos marcados.' };

  // Detalles de trial / programa (tabla 1:1). Se validan antes de crear nada.
  const isTrial = (TRIAL_TYPES as readonly string[]).includes(parsed.data.type);
  const ev = isTrial ? eventSchema.safeParse(Object.fromEntries(formData)) : null;
  if (ev && !ev.success) {
    const fe: Record<string, string> = {};
    for (const i of ev.error.issues) fe[String(i.path[0])] = i.message;
    return { fieldErrors: fe, error: 'Revisa la fecha, el lugar o el coste del trial.' };
  }

  const { submit, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from('opportunities')
    .insert({
      ...data,
      position_ids: positionIds.data,
      graduation_years: gradYears.data,
      required_materials: materials.data,
      created_by: session.userId,
      // Las cifras las aporta la organización: se etiquetan así hasta que el equipo las verifique.
      financial_source: data.annual_cost_usd != null || data.aid_amount_usd != null ? 'organization_provided' : null,
      status: submit === 'review' ? 'pending_review' : 'draft',
    })
    .select('id')
    .single();
  if (error || !created) {
    if (error?.message?.includes('scholarship_claim_consistent')) return { fieldErrors: { scholarship_status: 'Elige el estado de la beca.' }, error: 'Revisa la información de beca.' };
    return { error: 'No se ha podido crear la oportunidad. Comprueba que perteneces a la organización.' };
  }
  if (ev?.success) {
    const e = ev.data;
    const { error: detErr } = await supabase.from('opportunity_event_details').insert({
      opportunity_id: created.id, event_start_date: e.ev_start, event_end_date: e.ev_end, start_time_local: e.ev_time, timezone: e.ev_tz,
      country: e.ev_country, city: e.ev_city, venue: e.ev_venue, age_category: e.ev_cat,
      fee_type: e.ev_fee, fee_amount: e.ev_fee === 'paid' ? e.ev_amount : null, currency: e.ev_fee === 'paid' ? e.ev_currency : null,
      refundable: e.ev_fee === 'paid' ? e.ev_refund : 'unknown', accommodation: e.ev_acc, meals: e.ev_meals, travel: e.ev_travel, minor_policy: e.ev_minor,
    });
    // La oportunidad queda en borrador: si los detalles fallan, se ven como «sin completar» y se pueden añadir después.
    if (detErr) console.error('[opportunities] detalles de trial', detErr.message);
  }
  revalidatePath('/app/opportunities');
  redirect(`/app/opportunities/${created.id}`);
}

export async function submitForReview(formData: FormData) {
  await requireSession(['university', 'coach']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('opportunities').update({ status: 'pending_review' }).eq('id', id);
  revalidatePath(`/app/opportunities/${id}`);
}

export async function deleteOpportunity(formData: FormData) {
  await requireSession(['university', 'coach']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('opportunities').delete().eq('id', id).in('status', ['draft', 'rejected']);
  revalidatePath('/app/opportunities');
  redirect('/app/opportunities');
}

export async function applyToOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = z
    .object({ opportunity_id: z.string().uuid(), athlete_message: z.string().trim().max(2000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.from('applications').insert({
    opportunity_id: parsed.data.opportunity_id,
    athlete_id: session.userId,
    athlete_message: parsed.data.athlete_message || null,
  });
  if (error) {
    if (error.code === '23505') return { error: 'Ya has aplicado a esta oportunidad.' };
    if (error.message.includes('opportunity_not_open')) return { error: 'Esta oportunidad ya no admite candidaturas.' };
    return { error: 'No se ha podido enviar la candidatura.' };
  }
  revalidatePath(`/app/opportunities/${parsed.data.opportunity_id}`);
  revalidatePath('/app/applications');
  revalidatePath('/app/athlete');
  await logEvent('application_submitted');
  return { ok: true, message: 'Candidatura enviada. La universidad podrá ver tu Passport.' };
}

export async function withdrawApplication(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id).eq('athlete_id', session.userId);
  revalidatePath('/app/applications');
}

const STATUSES = ['applied', 'reviewed', 'contacted', 'information_requested', 'interview', 'tryout', 'shortlist', 'offer', 'accepted', 'declined'] as const;

export async function moveApplication(formData: FormData) {
  await requireSession(['university', 'coach']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('applications').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  revalidatePath('/app/applications');
}

export async function addApplicationNote(formData: FormData) {
  const session = await requireSession(['university', 'coach']);
  const parsed = z.object({ application_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('application_notes').insert({ ...parsed.data, author_id: session.userId });
  revalidatePath('/app/applications');
}
