'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

async function requireAdmin() {
  const session = await requireSession(['admin']);
  if (!session.roles.includes('admin')) throw new Error('admin_only');
  return session;
}

export async function reviewOrganization(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['verified', 'rejected']), institution_id: z.string().uuid().optional().or(z.literal('')) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from('organizations')
    .update({ verification_status: parsed.data.status, ...(parsed.data.institution_id ? { institution_id: parsed.data.institution_id } : {}) })
    .eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

export async function reviewOpportunity(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['published', 'rejected']), review_note: z.string().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('opportunities').update({ status: parsed.data.status, review_note: parsed.data.review_note || null }).eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

export async function reviewCampaign(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['published', 'rejected']), review_note: z.string().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('brand_campaigns').update({ status: parsed.data.status, review_note: parsed.data.review_note || null }).eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

export async function decideReport(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['actioned', 'dismissed', 'reviewing']), decision_reason: z.string().max(2000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('content_reports').update({ status: parsed.data.status, decision_reason: parsed.data.decision_reason || null }).eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

export async function verifyAthleteLink(formData: FormData) {
  await requireAdmin();
  const session = await requireSession();
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('athlete_links').update({ verified: true, verified_by: session.userId, verified_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/app/admin');
}

export async function resolveDataRequest(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['in_progress', 'completed', 'rejected']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from('data_subject_requests')
    .update({ status: parsed.data.status, resolved_at: parsed.data.status === 'in_progress' ? null : new Date().toISOString() })
    .eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

/**
 * Importa una institución desde College Scorecard (U.S. Department of Education).
 * Datos oficiales, con fuente y fecha. Requiere COLLEGE_SCORECARD_API_KEY (api.data.gov).
 */
const SCORECARD_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'school.price_calculator_url',
  'latest.cost.attendance.academic_year',
  'latest.cost.tuition.out_of_state',
].join(',');

const toHttps = (u: unknown) => {
  if (typeof u !== 'string' || !u.trim()) return null;
  const clean = u.trim().replace(/^http:\/\//, '');
  return clean.startsWith('https://') ? clean : `https://${clean}`;
};

export async function importFromScorecard(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const key = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!key) return { error: 'Falta COLLEGE_SCORECARD_API_KEY en las variables de entorno (clave gratuita en api.data.gov/signup).' };
  const query = z.string().trim().min(3).max(120).safeParse(formData.get('name'));
  if (!query.success) return { error: 'Escribe el nombre de la universidad.' };

  const url = new URL('https://api.data.gov/ed/collegescorecard/v1/schools');
  url.searchParams.set('api_key', key);
  url.searchParams.set('school.name', query.data);
  url.searchParams.set('fields', SCORECARD_FIELDS);
  url.searchParams.set('per_page', '5');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return { error: `College Scorecard respondió ${res.status}.` };
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  const rows = json.results ?? [];
  if (!rows.length) return { error: 'No hay resultados con ese nombre en College Scorecard.' };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({
    ipeds_unitid: Number(r['id']),
    name: String(r['school.name']),
    city: (r['school.city'] as string) ?? null,
    state: (r['school.state'] as string) ?? null,
    website_url: toHttps(r['school.school_url']),
    price_calculator_url: toHttps(r['school.price_calculator_url']),
    cost_attendance_usd: typeof r['latest.cost.attendance.academic_year'] === 'number' ? Math.round(r['latest.cost.attendance.academic_year'] as number) : null,
    tuition_out_of_state_usd: typeof r['latest.cost.tuition.out_of_state'] === 'number' ? Math.round(r['latest.cost.tuition.out_of_state'] as number) : null,
    data_source: 'college_scorecard',
    source_fetched_at: now,
  }));
  const { error } = await supabase.from('institutions').upsert(payload, { onConflict: 'ipeds_unitid' });
  if (error) return { error: 'No se ha podido guardar la importación.' };
  revalidatePath('/app/admin');
  revalidatePath('/app/universities');
  return { ok: true, message: `${payload.length} institución(es) importada(s): ${payload.map((p) => p.name).join(', ')}` };
}

const instLinks = z.object({
  id: z.string().uuid(),
  association: z.enum(['ncaa', 'naia', 'njcaa', 'other', '']).optional(),
  division: z.enum(['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia', 'njcaa', '']).optional(),
  conference: z.string().trim().max(120).optional(),
  athletics_url: z.string().trim().max(500).optional(),
  admissions_url: z.string().trim().max(500).optional(),
  international_url: z.string().trim().max(500).optional(),
  virtual_tour_url: z.string().trim().max(500).optional(),
});

export async function updateInstitutionAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = instLinks.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Datos no válidos.' };
  const sports = z.string().array().safeParse(formData.getAll('sports_offered'));
  const { id, ...d } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('institutions')
    .update({
      association: d.association || null,
      division: d.division || null,
      conference: d.conference || null,
      athletics_url: toHttps(d.athletics_url),
      admissions_url: toHttps(d.admissions_url),
      international_url: toHttps(d.international_url),
      virtual_tour_url: toHttps(d.virtual_tour_url),
      sports_offered: sports.success ? sports.data : [],
    })
    .eq('id', id);
  if (error) return { error: 'No se ha podido guardar.' };
  revalidatePath(`/app/universities/${id}`);
  return { ok: true, message: 'Institución actualizada y enlaces marcados como revisados.' };
}
