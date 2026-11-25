'use server';

import { getLocale } from '@/lib/i18n/server';
import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { ASSIGNABLE_ROLES, INTERNAL_STAGES } from '@/lib/domain/recruit';
import { currentRecruitOrg } from '@/lib/data/recruit';
import type { FormState } from './auth';

/**
 * Acciones del portal de recruiting. La autorización real está en la base de datos (org_can + RLS + triggers);
 * aquí solo se valida la forma de los datos y se traducen los errores a mensajes claros.
 */
const uuid = z.string().uuid();
const optUuid = z.union([uuid, z.literal('')]).optional().transform((v) => v || null);
const optDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null);
const intList = (s: unknown) => String(s ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12);

function friendly(msg: string) {
  if (msg.includes('assignee_not_member')) return 'Solo puedes asignar a miembros de tu organización.';
  if (msg.includes('assignee_not_authorized')) return 'Esa persona no tiene permiso para trabajar candidatos.';
  if (msg.includes('athlete_not_accessible')) return 'El atleta ya no comparte su perfil con vosotros.';
  if (msg.includes('not_an_authorized_member')) return 'Solo puedes compartir con miembros de tu organización con acceso a shortlists.';
  if (msg.includes('row-level security') || msg.includes('not_allowed') || msg.includes('42501')) return 'Tu rol no permite esta acción o la organización aún no está verificada.';
  if (msg.includes('duplicate') || msg.includes('unique')) return 'Ya existe.';
  if (msg.includes('last_admin')) return 'La organización necesita al menos un administrador.';
  if (msg.includes('rate_limited')) return 'Has alcanzado el límite diario de solicitudes.';
  return 'No se ha podido completar. Inténtalo de nuevo.';
}
function refresh(...paths: string[]) { for (const p of ['/app/recruit', ...paths]) revalidatePath(p); }

/* ------------------------------------------------------------------ Necesidades */
const needSchema = z.object({
  org: uuid, id: optUuid, title: z.string().trim().min(3).max(120), sport_id: z.string().min(2).max(40), program_id: optUuid,
  positions: z.string().optional(), years: z.string().optional(), slots: z.union([z.literal(''), z.coerce.number().int().min(1).max(50)]).optional(),
  min_height_cm: z.union([z.literal(''), z.coerce.number().int().min(120).max(230)]).optional(),
  requires_video: z.string().optional(), requires_documented_academics: z.string().optional(),
  countries: z.string().optional(), start_term: z.string().trim().max(40).optional(), internal_notes: z.string().trim().max(2000).optional(),
});
export async function saveNeed(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = needSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Revisa el título (3-120 caracteres) y el deporte.' };
  const d = p.data;
  const row = {
    organization_id: d.org, program_id: d.program_id, title: d.title, sport_id: d.sport_id,
    position_ids: intList(d.positions), class_years: intList(d.years).filter((y) => y >= 2024 && y <= 2040),
    slots: d.slots === '' || d.slots == null ? null : d.slots, min_height_cm: d.min_height_cm === '' || d.min_height_cm == null ? null : d.min_height_cm,
    requires_video: d.requires_video === 'on', requires_documented_academics: d.requires_documented_academics === 'on',
    countries: String(d.countries ?? '').toUpperCase().split(',').map((c) => c.trim()).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 30),
    start_term: d.start_term || null, internal_notes: d.internal_notes || null,
  };
  const supabase = await createClient();
  const { error } = d.id ? await supabase.from('recruiting_needs').update(row).eq('id', d.id) : await supabase.from('recruiting_needs').insert(row);
  if (error) return { error: friendly(error.message) };
  if (!d.id) await logEvent('recruiting_need_created');
  refresh('/app/recruit/needs');
  return { ok: true, message: 'Necesidad guardada (privada para tu staff)' };
}
export async function setNeedStatus(formData: FormData) {
  await requireSession();
  const t = z.object({ id: uuid, status: z.enum(['active', 'paused', 'filled', 'closed']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('recruiting_needs').update({ status: t.status }).eq('id', t.id), 'recruiting_needs.update');
  refresh('/app/recruit/needs');
}

/* ------------------------------------------------------------------ Shortlists */
export async function createShortlist(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const p = z.object({ org: uuid, name: z.string().trim().min(2).max(80), visibility: z.enum(['private', 'shared', 'program', 'team']), program_id: optUuid, need_id: optUuid }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Pon un nombre (2-80 caracteres).' };
  if (p.data.visibility === 'program' && !p.data.program_id) return { error: 'Elige el programa para compartirla con su staff.' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_shortlists').insert({ organization_id: p.data.org, name: p.data.name, visibility: p.data.visibility, program_id: p.data.program_id, need_id: p.data.need_id, owner_id: session.userId });
  if (error) return { error: friendly(error.message) };
  refresh('/app/recruit/shortlists', '/app/recruit/discover');
  return { ok: true, message: 'Shortlist creada' };
}

/** Añadir a shortlist: confirma solo cuando el servidor lo ha guardado. Devuelve un resultado para la interfaz. */
export async function addToShortlist(input: { list: string; athlete: string; fit?: number | null }) {
  await requireSession();
  const p = z.object({ list: uuid, athlete: uuid, fit: z.number().int().min(0).max(100).nullable().optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('organization_id, name').eq('id', p.data.list).maybeSingle();
  if (!list) return { ok: false, message: 'Shortlist no encontrada.' };
  const { error } = await supabase.from('org_shortlist_members').insert({ shortlist_id: p.data.list, organization_id: list.organization_id, athlete_id: p.data.athlete, fit_at_add: p.data.fit ?? null });
  if (error) {
    if (error.code === '23505') return { ok: true, message: `Ya estaba en ${list.name}`, already: true };
    return { ok: false, message: friendly(error.message) };
  }
  await logEvent('athlete_shortlisted');
  refresh(`/app/recruit/shortlists/${p.data.list}`, '/app/recruit/shortlists');
  return { ok: true, message: `Añadido a ${list.name}` };
}

export async function updateShortlistMember(formData: FormData) {
  await requireSession();
  const t = z.object({
    list: uuid, athlete: uuid, op: z.enum(['remove', 'reviewed', 'to_review', 'priority', 'unpriority', 'assign', 'up', 'down']), assignee: optUuid,
  }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const m = supabase.from('org_shortlist_members');
  if (t.op === 'remove') must(await m.delete().eq('shortlist_id', t.list).eq('athlete_id', t.athlete), 'recruiting_needs.update');
  else if (t.op === 'reviewed' || t.op === 'to_review') must(await m.update({ review_status: t.op }).eq('shortlist_id', t.list).eq('athlete_id', t.athlete), 'org_shortlist_members.update');
  else if (t.op === 'priority' || t.op === 'unpriority') must(await m.update({ priority: t.op === 'priority' }).eq('shortlist_id', t.list).eq('athlete_id', t.athlete), 'org_shortlist_members.update');
  else if (t.op === 'assign') { must(await m.update({ assigned_to: t.assignee }).eq('shortlist_id', t.list).eq('athlete_id', t.athlete), 'org_shortlist_members.update'); if (t.assignee) await logEvent('candidate_assigned'); }
  else {
    const { data } = await supabase.from('org_shortlist_members').select('athlete_id, position, added_at').eq('shortlist_id', t.list).order('position').order('added_at');
    const rows = data ?? [];
    const i = rows.findIndex((r) => r.athlete_id === t.athlete);
    const j = t.op === 'up' ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < rows.length) {
      [rows[i], rows[j]] = [rows[j], rows[i]];
      (await Promise.all(rows.map((r, k) => m.update({ position: k }).eq('shortlist_id', t.list).eq('athlete_id', r.athlete_id)))).forEach((res) => must(res, 'org_shortlist_members.update'));
    }
  }
  refresh(`/app/recruit/shortlists/${t.list}`);
}

export async function archiveShortlist(formData: FormData) {
  await requireSession();
  const t = z.object({ list: uuid, archive: z.enum(['1', '0']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('org_shortlists').update({ archived_at: t.archive === '1' ? new Date().toISOString() : null }).eq('id', t.list), 'org_shortlists.update');
  refresh('/app/recruit/shortlists');
}

/* ------------------------------------------------------------------ Candidatos (pipeline interno) */
/** Iniciar el proceso de recruiting. Requiere confirmación y no duplica si ya existe. */
export async function startRecruiting(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = z.object({ org: uuid, athlete: uuid, need_id: optUuid, program_id: optUuid, opportunity_id: optUuid, confirm: z.literal('yes') }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Confirma que quieres iniciar el proceso.' };
  const supabase = await createClient();
  const { data: existing } = await supabase.from('org_candidates').select('id, internal_stage, archived_at').eq('organization_id', p.data.org).eq('athlete_id', p.data.athlete).maybeSingle();
  if (existing && !existing.archived_at && !['new', 'review', 'shortlisted'].includes(existing.internal_stage)) return { ok: true, message: 'Ya tenía un proceso activo: no se ha duplicado.' };
  const row = { organization_id: p.data.org, athlete_id: p.data.athlete, need_id: p.data.need_id, program_id: p.data.program_id, opportunity_id: p.data.opportunity_id, internal_stage: 'active', source: 'shortlist', archived_at: null };
  const { error } = existing ? await supabase.from('org_candidates').update(row).eq('id', existing.id) : await supabase.from('org_candidates').insert(row);
  if (error) return { error: friendly(error.message) };
  await logEvent('candidate_stage_changed', { stage: 'active' });
  refresh('/app/recruit/candidates', `/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Proceso de recruiting creado. El atleta sigue en la shortlist.' };
}

export async function addCandidate(formData: FormData) {
  await requireSession();
  const t = z.object({ org: uuid, athlete: uuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('org_candidates').upsert({ organization_id: t.org, athlete_id: t.athlete, source: 'discovery' }, { onConflict: 'organization_id,athlete_id', ignoreDuplicates: true }), 'org_candidates.upsert');
  await logEvent('athlete_discovered');
  redirect(`/app/recruit/candidates/${t.athlete}`);
}

export async function updateCandidate(formData: FormData) {
  await requireSession();
  const t = z.object({ id: uuid, athlete: uuid, stage: z.enum(INTERNAL_STAGES).optional(), assignee: optUuid, op: z.enum(['stage', 'assign', 'archive', 'restore']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const c = supabase.from('org_candidates');
  if (t.op === 'stage' && t.stage) { await c.update({ internal_stage: t.stage }).eq('id', t.id); await logEvent('candidate_stage_changed', { stage: t.stage }); }
  if (t.op === 'assign') { await c.update({ assigned_to: t.assignee }).eq('id', t.id); if (t.assignee) await logEvent('candidate_assigned'); }
  if (t.op === 'archive' || t.op === 'restore') await c.update({ archived_at: t.op === 'archive' ? new Date().toISOString() : null }).eq('id', t.id);
  refresh('/app/recruit/candidates', `/app/recruit/candidates/${t.athlete}`);
}

/** Acción masiva segura: solo etapa interna o archivo (nunca mensajes masivos). */
export async function bulkCandidates(formData: FormData) {
  await requireSession();
  const ids = formData.getAll('ids').map(String).filter((x) => uuid.safeParse(x).success).slice(0, 100);
  const t = z.object({ op: z.enum(['stage', 'archive']), stage: z.enum(INTERNAL_STAGES).optional() }).parse({ op: formData.get('op'), stage: formData.get('stage') || undefined });
  if (!ids.length) return;
  const supabase = await createClient();
  if (t.op === 'archive') must(await supabase.from('org_candidates').update({ archived_at: new Date().toISOString() }).in('id', ids), 'org_candidates.update');
  else if (t.stage) must(await supabase.from('org_candidates').update({ internal_stage: t.stage }).in('id', ids), 'org_candidates.update');
  refresh('/app/recruit/candidates');
}

/* ------------------------------------------------------------------ Notas y tareas */
export async function addOrgNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const p = z.object({ org: uuid, athlete: uuid, body: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Escribe la nota (máx. 2000 caracteres).' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_notes').insert({ organization_id: p.data.org, athlete_id: p.data.athlete, author_id: session.userId, body: p.data.body });
  if (error) return { error: error.message.includes('unsafe_content') ? 'La nota no puede contener código ni enlaces ejecutables.' : friendly(error.message) };
  await logEvent('note_added');
  refresh(`/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Nota interna guardada' };
}
export async function deleteOrgNote(formData: FormData) {
  await requireSession();
  const t = z.object({ id: uuid, athlete: uuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('org_notes').delete().eq('id', t.id), 'org_notes.delete');
  refresh(`/app/recruit/candidates/${t.athlete}`);
}

export async function addOrgTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = z.object({ org: uuid, athlete: optUuid, title: z.string().trim().min(2).max(160), due_date: optDate, assignee: optUuid, priority: z.enum(['high', 'normal', 'low']).default('normal') }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Escribe la tarea (2-160 caracteres).' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_tasks').insert({ organization_id: p.data.org, athlete_id: p.data.athlete, title: p.data.title, due_date: p.data.due_date, assignee_id: p.data.assignee, priority: p.data.priority });
  if (error) return { error: friendly(error.message) };
  refresh('/app/recruit/tasks', ...(p.data.athlete ? [`/app/recruit/candidates/${p.data.athlete}`] : []));
  return { ok: true, message: 'Tarea creada' };
}
export async function toggleOrgTask(formData: FormData) {
  await requireSession();
  const t = z.object({ id: uuid, done: z.enum(['1', '0']), athlete: optUuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  must(await supabase.from('org_tasks').update({ status: t.done === '1' ? 'done' : 'open', done_at: t.done === '1' ? new Date().toISOString() : null }).eq('id', t.id), 'org_tasks.update');
  refresh('/app/recruit/tasks', ...(t.athlete ? [`/app/recruit/candidates/${t.athlete}`] : []));
}

/* ------------------------------------------------------------------ Solicitudes de información y ofertas */
export async function requestInfo(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const p = z.object({ org: uuid, athlete: uuid, kind: z.enum(['full_game_video', 'transcript', 'english_certificate', 'statistic', 'document', 'other']), message: z.string().trim().min(10).max(1000) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Explica qué necesitas (10-1000 caracteres).' };
  const supabase = await createClient();
  const { error } = await supabase.from('info_requests').insert({ organization_id: p.data.org, athlete_id: p.data.athlete, requested_by: session.userId, kind: p.data.kind, message: p.data.message });
  if (error) return { error: error.code === '23505' ? 'Ya hay una solicitud abierta de este tipo.' : friendly(error.message) };
  await logEvent('document_requested', { kind: p.data.kind });
  refresh(`/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Solicitud enviada. El atleta (o su familia, si es menor) decide.' };
}

/** Abrir un documento compartido: comprueba la concesión vigente, lo registra y genera un enlace de 5 minutos. */
export async function openSharedDocument(formData: FormData) {
  await requireSession();
  const id = uuid.parse(formData.get('request'));
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('log_document_access', { p_request: id });
  if (error || !path) redirect('/app/recruit/candidates?error=document');
  const { data } = await supabase.storage.from('athlete-documents').createSignedUrl(path as string, 300);
  if (!data?.signedUrl) redirect('/app/recruit/candidates?error=document');
  redirect(data.signedUrl);
}

export async function recordOrgOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const num = z.union([z.literal(''), z.coerce.number().int().min(0).max(200000)]).optional().transform((v) => (v === '' || v == null ? null : v));
  const p = z.object({ candidate: uuid, athlete: uuid, annual_cost: num, aid: num, renewable: z.enum(['yes', 'no', 'unknown']), in_writing: z.string().optional(), deadline: optDate, type: z.enum(['athletic', 'academic', 'mixed', 'unknown']), confirm: z.literal('yes') }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Revisa los importes y confirma la oferta.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('org_record_offer', { p_candidate: p.data.candidate, p_annual_cost: p.data.annual_cost, p_aid: p.data.aid, p_renewable: p.data.renewable, p_in_writing: p.data.in_writing === 'on', p_deadline: p.data.deadline, p_type: p.data.type });
  if (error) return { error: error.message.includes('aid_above_cost') ? 'La ayuda no puede superar el coste.' : friendly(error.message) };
  await logEvent('offer_created');
  refresh(`/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Oferta registrada y comunicada al atleta en Gala.' };
}

/* ------------------------------------------------------------------ Equipo y programas */
export async function saveProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = z.object({ org: uuid, sport_id: z.string().min(2).max(40), gender: z.enum(['women', 'men', 'coed']), name: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Revisa el nombre del programa.' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_programs').insert({ organization_id: p.data.org, sport_id: p.data.sport_id, gender: p.data.gender, name: p.data.name });
  if (error) return { error: error.code === '23505' ? 'Ya existe ese programa.' : friendly(error.message) };
  revalidatePath('/app/organization');
  return { ok: true, message: 'Programa creado' };
}

export async function updateMember(formData: FormData) {
  await requireSession();
  const t = z.object({ org: uuid, user: uuid, op: z.enum(['role', 'remove', 'transfer', 'title']), role: z.enum(ASSIGNABLE_ROLES as [string, ...string[]]).optional(), title: z.string().trim().max(80).optional() }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (t.op === 'role' && t.role) ({ error } = await supabase.from('organization_members').update({ member_role: t.role }).eq('organization_id', t.org).eq('user_id', t.user));
  if (t.op === 'title') ({ error } = await supabase.from('organization_members').update({ title: t.title || null }).eq('organization_id', t.org).eq('user_id', t.user));
  if (t.op === 'remove') ({ error } = await supabase.from('organization_members').delete().eq('organization_id', t.org).eq('user_id', t.user));
  if (t.op === 'transfer') ({ error } = await supabase.rpc('org_transfer_ownership', { p_org: t.org, p_user: t.user }));
  revalidatePath('/app/organization');
  if (error) redirect(`/app/organization?error=${encodeURIComponent(friendly(error.message))}`);
}

export async function setMemberPrograms(formData: FormData) {
  await requireSession();
  const org = uuid.parse(formData.get('org'));
  const user = uuid.parse(formData.get('user'));
  const programs = formData.getAll('programs').map(String).filter((x) => uuid.safeParse(x).success);
  const supabase = await createClient();
  must(await supabase.from('organization_members').update({ program_ids: programs }).eq('organization_id', org).eq('user_id', user), 'organization_members.update');
  revalidatePath('/app/organization');
}

/* ------------------------------------------------------------------ Lado del atleta: responder solicitudes */
export async function respondInfoRequest(formData: FormData) {
  await requireSession();
  const t = z.object({ id: uuid, share: z.enum(['1', '0']), document: optUuid, until: optDate }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_info_request', { p_id: t.id, p_share: t.share === '1', p_document: t.document, p_until: t.until });
  if (!error && t.share === '1') await logEvent('document_shared');
  revalidatePath('/app/requests');
  if (error) redirect(`/app/requests?error=${encodeURIComponent(error.message.includes('guardian_required') ? 'Al ser menor, tu familia debe responder esta solicitud.' : 'No se ha podido responder.')}`);
}

/* ------------------------------------------------------------------ Quick View (móvil) */
export type QuickView = {
  ok: true; minor: boolean; academics: 'documented' | 'declared' | 'private';
  videos: { id: string; kind: string; title: string | null; url: string }[];
  stats: { label: string; value: string; verified: boolean }[];
  inPipeline: boolean;
} | { ok: false; message: string };

/**
 * Datos para la vista rápida: los mismos que la ficha, recortados (vídeo, 3–5 métricas, verificación).
 * Lee con la sesión del coach: la RLS por bloque decide qué llega. Nunca recalcula Gala Match.
 */
export async function loadQuickView(input: { org: string; athlete: string }): Promise<QuickView> {
  const english = (await getLocale()) === 'en';
  const session = await requireSession();
  const p = z.object({ org: uuid, athlete: uuid }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const { org } = await currentRecruitOrg(session.userId, p.data.org);
  if (!org || !org.caps.has('discover')) return { ok: false, message: 'Tu acceso ya no permite ver este perfil.' };
  const supabase = await createClient();
  const [{ data: minor }, { data: acad }, { data: stats }, { data: videos }, { data: cand }] = await Promise.all([
    supabase.rpc('viewer_is_minor', { p_user: p.data.athlete }),
    supabase.from('athlete_academics').select('gpa_source').eq('athlete_id', p.data.athlete).maybeSingle(),
    supabase.from('athlete_statistics').select('season, value, source, sport_stat_definitions(label_es, label_en, unit)').eq('athlete_id', p.data.athlete).order('season', { ascending: false }).limit(5),
    supabase.from('athlete_videos').select('id, kind, title, url').eq('athlete_id', p.data.athlete).order('is_featured', { ascending: false }).limit(4),
    supabase.from('org_candidates').select('internal_stage, archived_at').eq('organization_id', org.id).eq('athlete_id', p.data.athlete).maybeSingle(),
  ]);
  await logEvent('athlete_quick_view');
  return {
    ok: true,
    minor: minor !== false,
    academics: !acad ? 'private' : acad.gpa_source !== 'self_reported' ? 'documented' : 'declared',
    videos: (videos ?? []).map((v) => ({ id: v.id as string, kind: v.kind as string, title: v.title as string | null, url: v.url as string })),
    stats: (stats ?? []).map((s) => {
      const d = s.sport_stat_definitions as unknown as { label_es: string; label_en: string | null; unit: string | null } | null;
      return { label: `${(english ? d?.label_en : null) ?? d?.label_es ?? (english ? 'Stat' : 'Dato')} (${s.season})`, value: `${s.value}${d?.unit ? ` ${d.unit}` : ''}`, verified: s.source !== 'self_reported' };
    }),
    inPipeline: !!cand && !cand.archived_at && !['new', 'review', 'shortlisted', 'closed'].includes(cand.internal_stage as string),
  };
}

/* ------------------------------------------------------------------ Shortlist → Pipeline, compartir y asignar con tarea (móvil) */
export type PromoteResult = { ok: boolean; message: string; existed?: boolean };
/** Iniciar el recruiting desde una shortlist: explícito, sin duplicados y conservando el vínculo (función shortlist_promote). */
export async function promoteFromShortlist(input: { list: string; athlete: string; need?: string; opportunity?: string }): Promise<PromoteResult> {
  await requireSession();
  const p = z.object({ list: uuid, athlete: uuid, need: uuid.optional(), opportunity: uuid.optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('organization_id').eq('id', p.data.list).maybeSingle();
  if (!list) return { ok: false, message: 'Shortlist no encontrada.' };
  const { data: before } = await supabase.from('org_candidates').select('internal_stage, archived_at').eq('organization_id', list.organization_id).eq('athlete_id', p.data.athlete).maybeSingle();
  const existed = !!before && !before.archived_at && !['new', 'review', 'priority_review', 'shortlisted', 'closed'].includes(before.internal_stage as string);
  const { error } = await supabase.rpc('shortlist_promote', { p_list: p.data.list, p_athlete: p.data.athlete, p_need: p.data.need ?? null, p_opportunity: p.data.opportunity ?? null });
  if (error) return { ok: false, message: friendly(error.message) };
  await logEvent('athlete_promoted_to_pipeline');
  refresh(`/app/recruit/shortlists/${p.data.list}`, '/app/recruit/candidates');
  return { ok: true, existed, message: existed ? 'Ya tenía un proceso activo: no se ha duplicado.' : 'Proceso de recruiting creado. El atleta sigue en la shortlist.' };
}

/** Compartir una shortlist con una persona del staff (o revocar). La BD comprueba que sea miembro con acceso a shortlists. */
export async function shareShortlist(formData: FormData) {
  const session = await requireSession();
  const t = z.object({ list: uuid, user: uuid, role: z.enum(['editor', 'contributor', 'viewer']).optional(), revoke: z.literal('1').optional() }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('organization_id').eq('id', t.list).maybeSingle();
  if (!list) return;
  if (t.revoke) must(await supabase.from('shortlist_access').update({ revoked_at: new Date().toISOString() }).eq('shortlist_id', t.list).eq('user_id', t.user), 'shortlist_access.update');
  else await supabase.from('shortlist_access').upsert({ shortlist_id: t.list, organization_id: list.organization_id, user_id: t.user, access_role: t.role ?? 'viewer', granted_by: session.userId, revoked_at: null });
  refresh(`/app/recruit/shortlists/${t.list}`);
}

/** Asignar desde la shortlist y, opcionalmente, crear la tarea en el sistema central de tareas (org_tasks). */
export async function assignWithTask(input: { list: string; athlete: string; assignee: string | null; task?: string; due?: string }): Promise<{ ok: boolean; message: string }> {
  await requireSession();
  const p = z.object({ list: uuid, athlete: uuid, assignee: uuid.nullable(), task: z.string().trim().max(160).optional(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')) }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: list } = await supabase.from('org_shortlists').select('organization_id').eq('id', p.data.list).maybeSingle();
  if (!list) return { ok: false, message: 'Shortlist no encontrada.' };
  const { error } = await supabase.from('org_shortlist_members').update({ assigned_to: p.data.assignee }).eq('shortlist_id', p.data.list).eq('athlete_id', p.data.athlete);
  if (error) return { ok: false, message: friendly(error.message) };
  if (p.data.task && p.data.task.length >= 2) {
    const { error: te } = await supabase.from('org_tasks').insert({ organization_id: list.organization_id, athlete_id: p.data.athlete, shortlist_id: p.data.list, title: p.data.task, due_date: p.data.due || null, assignee_id: p.data.assignee });
    if (te) return { ok: false, message: 'Asignado, pero la tarea no se ha podido crear.' };
  }
  if (p.data.assignee) await logEvent('candidate_assigned');
  refresh(`/app/recruit/shortlists/${p.data.list}`, '/app/recruit/tasks');
  return { ok: true, message: p.data.assignee ? 'Asignado' : 'Asignación quitada' };
}

/* ------------------------------------------------------------------ Modo scout (móvil): nota y asignación sin salir de Discovery */
/** Nota interna rápida desde la Vista rápida. Solo la ven miembros autorizados (RLS de org_notes). */
export async function quickNote(input: { org: string; athlete: string; body: string }): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  const p = z.object({ org: uuid, athlete: uuid, body: z.string().trim().min(1).max(2000) }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Escribe la nota (máx. 2000 caracteres).' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_notes').insert({ organization_id: p.data.org, athlete_id: p.data.athlete, author_id: session.userId, body: p.data.body });
  if (error) return { ok: false, message: error.message.includes('unsafe_content') ? 'La nota no puede contener código ni enlaces ejecutables.' : friendly(error.message) };
  await logEvent('scout_note_added');
  refresh(`/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Nota guardada' };
}

/** Asignar un atleta a un miembro del staff con una tarea (p. ej. «Revisar partido completo» para el viernes). */
export async function quickAssign(input: { org: string; athlete: string; assignee: string; task: string; due?: string }): Promise<{ ok: boolean; message: string }> {
  await requireSession();
  const p = z.object({ org: uuid, athlete: uuid, assignee: uuid, task: z.string().trim().min(2).max(160), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')) }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Elige a quién y escribe la tarea.' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_tasks').insert({ organization_id: p.data.org, athlete_id: p.data.athlete, title: p.data.task, due_date: p.data.due || null, assignee_id: p.data.assignee });
  if (error) return { ok: false, message: friendly(error.message) };
  await logEvent('candidate_assigned');
  refresh('/app/recruit/tasks', `/app/recruit/candidates/${p.data.athlete}`);
  return { ok: true, message: 'Asignado' };
}
