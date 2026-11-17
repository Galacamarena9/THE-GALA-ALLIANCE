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
  'latest.admissions.sat_scores.average.overall',
  'latest.admissions.admission_rate.overall',
  'school.ownership',
  'school.locale',
  'latest.student.size',
  'latest.cost.tuition.in_state',
  'latest.cost.avg_net_price.public',
  'latest.cost.avg_net_price.private',
  'latest.completion.completion_rate_4yr_150nt',
].join(',');
/** Programas por código CIP (pueden no venir en todas las respuestas; se piden aparte y con respaldo). */
const SCORECARD_PROGRAMS = 'latest.programs.cip_4_digit';

const LOCALE: Record<number, 'city' | 'suburb' | 'town' | 'rural'> = { 1: 'city', 2: 'suburb', 3: 'town', 4: 'rural' };
const OWNERSHIP: Record<number, 'public' | 'private_nonprofit' | 'private_forprofit'> = { 1: 'public', 2: 'private_nonprofit', 3: 'private_forprofit' };

/** CIP de 4 dígitos de los programas de grado (bachelor, nivel 3). Formato defensivo: si cambia, devuelve []. */
function bachelorCips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as { code?: unknown; credential?: { level?: unknown } };
    const code = typeof o.code === 'string' || typeof o.code === 'number' ? String(o.code).replace('.', '').padStart(4, '0').slice(0, 4) : null;
    if (code && /^\d{4}$/.test(code) && Number(o.credential?.level) === 3) out.add(code);
  }
  return [...out].sort();
}

const toHttps = (u: unknown) => {
  if (typeof u !== 'string' || !u.trim()) return null;
  const clean = u.trim().replace(/^http:\/\//, '');
  return clean.startsWith('https://') ? clean : `https://${clean}`;
};

/** Fila de College Scorecard → fila de `institutions` (con fuente y fecha de la descarga). */
function mapScorecardRow(r: Record<string, unknown>, now: string) {
  const num = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  const cost = num('latest.cost.attendance.academic_year');
  const tuition = num('latest.cost.tuition.out_of_state');
  const sat = num('latest.admissions.sat_scores.average.overall');
  const rate = num('latest.admissions.admission_rate.overall');
  const net = num('latest.cost.avg_net_price.public') ?? num('latest.cost.avg_net_price.private');
  const grad = num('latest.completion.completion_rate_4yr_150nt');
  const size = num('latest.student.size');
  const tuitionIn = num('latest.cost.tuition.in_state');
  const locale = num('school.locale');
  const own = num('school.ownership');
  return {
    ipeds_unitid: Number(r['id']),
    name: String(r['school.name']),
    city: (r['school.city'] as string) ?? null,
    state: (r['school.state'] as string) ?? null,
    website_url: toHttps(r['school.school_url']),
    price_calculator_url: toHttps(r['school.price_calculator_url']),
    cost_attendance_usd: cost == null ? null : Math.round(cost),
    tuition_out_of_state_usd: tuition == null ? null : Math.round(tuition),
    sat_avg: sat == null ? null : Math.round(sat),
    admission_rate: rate == null ? null : Number(rate.toFixed(4)),
    enrollment: size == null ? null : Math.round(size),
    ownership: own == null ? null : OWNERSHIP[own] ?? null,
    locale: locale == null ? null : LOCALE[Math.floor(locale / 10)] ?? null,
    graduation_rate: grad == null || grad < 0 || grad > 1 ? null : Number(grad.toFixed(4)),
    tuition_in_state_usd: tuitionIn == null ? null : Math.round(tuitionIn),
    net_price_usd: net == null || net < 0 ? null : Math.round(net),
    ...(SCORECARD_PROGRAMS in r ? { program_cips: bachelorCips(r[SCORECARD_PROGRAMS]) } : {}),
    data_source: 'college_scorecard',
    source_fetched_at: now,
  };
}

export async function importFromScorecard(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const key = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!key) return { error: 'Falta COLLEGE_SCORECARD_API_KEY en las variables de entorno (clave gratuita en api.data.gov/signup).' };
  const query = z.string().trim().min(3).max(120).safeParse(formData.get('name'));
  if (!query.success) return { error: 'Escribe el nombre de la universidad.' };

  const url = new URL('https://api.data.gov/ed/collegescorecard/v1/schools');
  url.searchParams.set('api_key', key);
  url.searchParams.set('school.name', query.data);
  url.searchParams.set('fields', `${SCORECARD_FIELDS},${SCORECARD_PROGRAMS}`);
  url.searchParams.set('per_page', '5');

  let res = await fetch(url, { cache: 'no-store' });
  if (!res.ok && res.status === 400) {
    url.searchParams.set('fields', SCORECARD_FIELDS);
    res = await fetch(url, { cache: 'no-store' });
  }
  if (!res.ok) return { error: `College Scorecard respondió ${res.status}.` };
  const json = (await res.json()) as { results?: Record<string, unknown>[] };
  const rows = json.results ?? [];
  if (!rows.length) return { error: 'No hay resultados con ese nombre en College Scorecard.' };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const payload = rows.map((r) => mapScorecardRow(r, now));
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
    })
    .eq('id', id);
  if (error) return { error: 'No se ha podido guardar.' };
  revalidatePath(`/app/universities/${id}`);
  return { ok: true, message: 'Institución actualizada y enlaces marcados como revisados.' };
}


/**
 * Importación completa del catálogo, por lotes (cada llamada trae hasta 3 páginas de 100 = 300 instituciones,
 * para no superar el tiempo máximo de una función). Solo instituciones activas (`school.operating=1`) cuya titulación
 * principal es de grado asociado, grado o posgrado (`predominant=2,3,4`): es donde existen los programas NCAA, NAIA y JUCO.
 * College Scorecard NO indica la división deportiva: eso se completa a mano por institución (enlaces y división).
 * Idempotente: `upsert` por `ipeds_unitid`, se puede repetir sin duplicar.
 */
export type ScorecardBatchResult = { ok: true; imported: number; total: number; nextPage: number | null } | { ok: false; error: string };

const BULK_PAGES_PER_CALL = 3;
const BULK_PER_PAGE = 100;

export async function importScorecardBatch(startPage: number): Promise<ScorecardBatchResult> {
  await requireAdmin();
  const key = process.env.COLLEGE_SCORECARD_API_KEY;
  if (!key) return { ok: false, error: 'Falta COLLEGE_SCORECARD_API_KEY en las variables de entorno de Netlify (clave gratuita en api.data.gov/signup).' };
  const page0 = z.number().int().min(0).max(1000).safeParse(startPage);
  if (!page0.success) return { ok: false, error: 'Página no válida.' };

  const supabase = await createClient();
  const now = new Date().toISOString();
  let imported = 0;
  let total = 0;
  let page = page0.data;

  for (let i = 0; i < BULK_PAGES_PER_CALL; i++, page++) {
    const url = new URL('https://api.data.gov/ed/collegescorecard/v1/schools');
    url.searchParams.set('api_key', key);
    url.searchParams.set('school.operating', '1');
    url.searchParams.set('school.degrees_awarded.predominant', '2,3,4');
    url.searchParams.set('fields', `${SCORECARD_FIELDS},${SCORECARD_PROGRAMS}`);
    url.searchParams.set('sort', 'id');
    url.searchParams.set('per_page', String(BULK_PER_PAGE));
    url.searchParams.set('page', String(page));

    let res = await fetch(url, { cache: 'no-store' });
    if (!res.ok && res.status === 400) {
      // Si la API rechaza el campo de programas, se importa el resto (los programas quedan como "no disponibles").
      url.searchParams.set('fields', SCORECARD_FIELDS);
      res = await fetch(url, { cache: 'no-store' });
    }
    if (!res.ok) return { ok: false, error: `College Scorecard respondió ${res.status} en la página ${page}. Puedes reanudar desde aquí.` };
    const json = (await res.json()) as { metadata?: { total?: number }; results?: Record<string, unknown>[] };
    total = json.metadata?.total ?? total;
    const rows = json.results ?? [];
    if (!rows.length) return { ok: true, imported, total, nextPage: null };

    const { error } = await supabase.from('institutions').upsert(rows.map((r) => mapScorecardRow(r, now)), { onConflict: 'ipeds_unitid' });
    if (error) return { ok: false, error: `No se ha podido guardar la página ${page}. Puedes reanudar desde aquí.` };
    imported += rows.length;
    if ((page + 1) * BULK_PER_PAGE >= total) {
      revalidatePath('/app/universities');
      return { ok: true, imported, total, nextPage: null };
    }
  }
  return { ok: true, imported, total, nextPage: page };
}

/** Ejecuta la caducidad de oportunidades vencidas (también corre a diario). */
export async function expireOpportunitiesNow() {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.rpc('expire_stale_opportunities');
  revalidatePath('/app/admin');
}
