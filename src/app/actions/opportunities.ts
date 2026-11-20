'use server';

import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { REQUIRED_MATERIAL_LABEL, validatePublish } from '@/lib/domain/recruit';
import { CLUB_TYPES, PROGRAM_TYPES, localToInstant } from '@/lib/domain/trials';

const optDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null);
const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
/** Trial / programa: datos del núcleo (fecha real con zona, ubicación) + especialización + costes. La BD repite estas reglas al publicar. */
const optNum = (min: number, max: number) => z.union([z.literal(''), z.coerce.number().min(min).max(max)]).optional().transform((v) => (v === '' || v == null ? null : v));
const eventSchema = z.object({
  ev_start: optDate, ev_end: optDate,
  ev_time: z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)]).optional().transform((v) => v || null),
  ev_tz: z.string().trim().regex(/^([A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2}|UTC)$/, 'Zona horaria no válida (ej.: Europe/Madrid)').optional().or(z.literal('')).transform((v) => v || null),
  ev_country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Código de país de 2 letras').optional().or(z.literal('')).transform((v) => v || null),
  ev_city: optStr(80), ev_venue: optStr(120), ev_cat: optStr(40),
  ev_age_min: optNum(5, 45), ev_age_max: optNum(5, 45),
  ev_mode: z.enum(['direct', 'application_required', 'invitation_only']).default('direct'),
  ev_capacity: optNum(1, 10000),
  ev_price: z.enum(['free', 'paid', 'price_not_provided']).default('price_not_provided'),
  ev_amount: optNum(0, 1000000),
  ev_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Moneda ISO (EUR, USD…)').optional().or(z.literal('')).transform((v) => v || null),
  ev_acc_amount: optNum(0, 1000000),
  ev_refund: z.enum(['yes', 'no', 'partial', 'unknown']).default('unknown'),
  ev_acc: z.enum(['included', 'available_paid', 'not_included', 'unknown']).default('unknown'),
  ev_meals: z.enum(['included', 'not_included', 'unknown']).default('unknown'),
  ev_travel: z.enum(['included', 'not_included', 'unknown']).default('unknown'),
  ev_minor: z.enum(['guardian_consent_required', 'adults_only']).default('guardian_consent_required'),
  ev_calendar: z.enum(['fixed_term', 'rolling', 'seasonal', 'one_off']).default('fixed_term'),
  ev_residential: z.enum(['residential', 'non_residential', 'both', 'unknown']).default('unknown'),
  ev_education: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  ev_aid: z.enum(['available', 'not_available', 'unknown']).default('unknown'),
}).superRefine((e, ctx) => {
  if (e.ev_price === 'paid' && e.ev_amount == null) ctx.addIssue({ code: 'custom', path: ['ev_amount'], message: 'Indica el importe: una oportunidad de pago siempre muestra su coste.' });
  if (e.ev_price === 'paid' && !e.ev_currency) ctx.addIssue({ code: 'custom', path: ['ev_currency'], message: 'Indica la moneda.' });
  if (e.ev_start && e.ev_end && e.ev_end < e.ev_start) ctx.addIssue({ code: 'custom', path: ['ev_end'], message: 'La fecha de fin es anterior al inicio.' });
  if ((e.ev_start || e.ev_time) && !e.ev_tz) ctx.addIssue({ code: 'custom', path: ['ev_tz'], message: 'Indica la zona horaria del evento.' });
  if (e.ev_age_min != null && e.ev_age_max != null && e.ev_age_max < e.ev_age_min) ctx.addIssue({ code: 'custom', path: ['ev_age_max'], message: 'La edad máxima es menor que la mínima.' });
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
    type: z.enum(['athletic_scholarship', 'university_recruitment', 'club_recruitment', 'academy', 'tryout', 'camp_showcase', 'development_program']),
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

  // Trials y programas: núcleo + especialización + costes + requisitos. Se validan antes de crear nada.
  const isClub = (CLUB_TYPES as readonly string[]).includes(parsed.data.type);
  const isProgram = (PROGRAM_TYPES as readonly string[]).includes(parsed.data.type);
  const ev = isClub ? eventSchema.safeParse(Object.fromEntries(formData)) : null;
  if (ev && !ev.success) {
    const fe: Record<string, string> = {};
    for (const i of ev.error.issues) fe[String(i.path[0])] = i.message;
    return { fieldErrors: fe, error: 'Revisa la fecha, el lugar o el coste.' };
  }
  const e = ev?.success ? ev.data : null;
  const supabase = await createClient();
  const { data: cats } = e?.ev_cat ? await supabase.from('age_categories').select('code').eq('code', e.ev_cat.toUpperCase().replace(/\s+/g, '_')).maybeSingle() : { data: null };
  const { submit, ...data } = parsed.data;
  // Siempre se crea como borrador; el envío a revisión es un paso aparte que la base de datos valida.
  const { data: created, error } = await supabase
    .from('opportunities')
    .insert({
      ...data,
      position_ids: positionIds.data,
      graduation_years: gradYears.data,
      required_materials: materials.data,
      created_by: session.userId,
      financial_source: data.annual_cost_usd != null || data.aid_amount_usd != null ? 'organization_provided' : null,
      status: 'draft',
      ...(e ? {
        start_at: e.ev_start && e.ev_tz ? localToInstant(e.ev_start, e.ev_time, e.ev_tz) : null,
        end_at: e.ev_end && e.ev_tz ? localToInstant(e.ev_end, '23:59', e.ev_tz) : null,
        timezone: e.ev_tz, country: e.ev_country, city: e.ev_city, venue_name: e.ev_venue,
        age_category_code: cats?.code ?? null, age_category_custom: cats ? null : e.ev_cat,
      } : {}),
    })
    .select('id')
    .single();
  if (error || !created) {
    if (error?.message?.includes('scholarship_claim_consistent')) return { fieldErrors: { scholarship_status: 'Elige el estado de la beca.' }, error: 'Revisa la información de beca.' };
    if (error?.message?.includes('invalid_timezone')) return { fieldErrors: { ev_tz: 'Zona horaria desconocida (ej.: Europe/Madrid).' }, error: 'Revisa la zona horaria.' };
    return { error: 'No se ha podido crear la oportunidad. Comprueba que perteneces a la organización.' };
  }
  if (e) {
    const detail = isProgram
      ? supabase.from('academy_program_details').insert({
          opportunity_id: created.id, calendar_type: e.ev_calendar, residential: e.ev_residential, accommodation: e.ev_acc, meals: e.ev_meals,
          education_support: e.ev_education, capacity: e.ev_capacity, price_status: e.ev_price, financial_aid: e.ev_aid, minor_policy: e.ev_minor,
        })
      : supabase.from('trial_details').insert({
          opportunity_id: created.id, trial_type: data.type === 'camp_showcase' ? 'camp' : data.type === 'club_recruitment' ? 'assessment' : 'open_trial',
          registration_mode: e.ev_mode, capacity: e.ev_capacity, price_status: e.ev_price, refundable: e.ev_price === 'paid' ? e.ev_refund : 'unknown',
          accommodation: e.ev_acc, meals: e.ev_meals, travel: e.ev_travel, minor_policy: e.ev_minor,
        });
    const costs = [
      ...(e.ev_price === 'paid' && e.ev_amount != null ? [{ component_type: isProgram ? 'program_fee' : 'registration', label: isProgram ? 'Cuota del programa' : 'Inscripción', amount: e.ev_amount, currency: e.ev_currency, required: true, sort: 10 }] : []),
      ...(e.ev_acc === 'available_paid' ? [{ component_type: 'accommodation', label: 'Alojamiento', amount: e.ev_acc_amount, currency: e.ev_acc_amount != null ? e.ev_currency ?? 'EUR' : null, required: false, sort: 20 }] : []),
      ...(e.ev_acc === 'included' ? [{ component_type: 'accommodation', label: 'Alojamiento', included: true, required: true, sort: 20 }] : []),
      ...(e.ev_meals === 'included' ? [{ component_type: 'meals', label: 'Comidas', included: true, required: true, sort: 30 }] : []),
    ].map((c) => ({ ...c, opportunity_id: created.id, updated_by: session.userId }));
    const reqs = e.ev_age_min != null || e.ev_age_max != null
      ? [{ opportunity_id: created.id, kind: 'age', strength: 'required', params: { ...(e.ev_age_min != null ? { min: e.ev_age_min } : {}), ...(e.ev_age_max != null ? { max: e.ev_age_max } : {}) }, label: 'Edad' }]
      : [];
    const mats = materials.data.map((m) => ({ opportunity_id: created.id, material: m, required: true }));
    const results = await Promise.all([
      detail,
      costs.length ? supabase.from('opportunity_cost_components').insert(costs) : Promise.resolve({ error: null }),
      reqs.length ? supabase.from('opportunity_requirements').insert(reqs) : Promise.resolve({ error: null }),
      mats.length ? supabase.from('opportunity_required_materials').insert(mats) : Promise.resolve({ error: null }),
    ]);
    // El borrador existe aunque algo falle: se verá «sin completar» y se puede corregir antes de publicar.
    for (const r of results) if (r.error) console.error('[opportunities] detalles', r.error.message);
  }
  if (submit === 'review') {
    const { error: pubErr } = await supabase.from('opportunities').update({ status: 'pending_review' }).eq('id', created.id);
    if (pubErr) {
      revalidatePath('/app/opportunities');
      redirect(`/app/opportunities/${created.id}?publish=incomplete`);
    }
  }
  revalidatePath('/app/opportunities');
  redirect(`/app/opportunities/${created.id}`);
}

export async function submitForReview(formData: FormData) {
  await requireSession(['university', 'coach']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('opportunities').update({ status: 'pending_review' }).eq('id', id);
  revalidatePath(`/app/opportunities/${id}`);
  if (error?.message?.includes('not_publishable')) redirect(`/app/opportunities/${id}?publish=incomplete`);
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
