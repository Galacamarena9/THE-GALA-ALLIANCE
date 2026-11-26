'use server';

import { must, bestEffort } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession, requireSession } from '@/lib/session';
import { requireAdmin } from '@/lib/admin-guard';
import type { FormState } from '@/app/actions/auth';
import { logEvent } from '@/lib/events';
import { createHash } from 'node:crypto';
import { uploadMatches } from '@/lib/domain/file-sniff';
import { DOC_CHECKLIST, DOC_KINDS, suggestedDueDate } from '@/content/documents';
import { planByCode } from '@/content/plans';


// ---------------------------------------------------------------- Centro de documentos
/** Atletas a los que esta sesión puede gestionar documentos: uno mismo o hijos vinculados. */
async function canManage(athleteId: string) {
  const session = await requireSession(['athlete', 'parent']);
  if (session.userId === athleteId) return session;
  const supabase = await createClient();
  const { data } = await supabase.from('parent_athlete_links').select('can_edit_profile').eq('parent_id', session.userId)
    .eq('athlete_id', athleteId).eq('status', 'approved').maybeSingle();
  return data?.can_edit_profile ? session : null;
}

/** Crea la checklist estándar con fechas recomendadas según el año de graduación (una sola vez). */
export async function seedDocumentChecklist(formData: FormData) {
  const athleteId = z.string().uuid().safeParse(formData.get('athlete_id'));
  if (!athleteId.success || !(await canManage(athleteId.data))) return;
  const supabase = await createClient();
  const { data: ap } = await supabase.from('athlete_profiles').select('graduation_year').eq('user_id', athleteId.data).maybeSingle();
  const { data: existing } = await supabase.from('athlete_documents').select('kind').eq('athlete_id', athleteId.data);
  const have = new Set((existing ?? []).map((d) => d.kind));
  const rows = DOC_CHECKLIST.filter((d) => !have.has(d.kind)).map((d) => ({
    athlete_id: athleteId.data, kind: d.kind, title: d.title, due_date: suggestedDueDate(d.kind, ap?.graduation_year ?? null),
  }));
  if (rows.length) must(await supabase.from('athlete_documents').insert(rows), 'athlete_documents.insert');
  revalidatePath('/app/documents');
}

export async function setDocumentDueDate(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), athlete_id: z.string().uuid(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')) })
    .safeParse({ id: formData.get('id'), athlete_id: formData.get('athlete_id'), due_date: formData.get('due_date') });
  if (!parsed.success || !(await canManage(parsed.data.athlete_id))) return;
  const supabase = await createClient();
  must(await supabase.from('athlete_documents').update({ due_date: parsed.data.due_date || null }).eq('id', parsed.data.id), 'athlete_documents.update');
  revalidatePath('/app/documents');
}

/** Registra un archivo ya subido a Storage por el navegador (la RLS de Storage validó el permiso). */
export async function recordDocumentUpload(input: { id: string; athleteId: string; path: string; mime: string; size: number }) {
  const parsed = z.object({
    id: z.string().uuid(), athleteId: z.string().uuid(),
    path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,180}$/),
    mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']), size: z.number().int().min(1).max(10_485_760),
  }).safeParse(input);
  if (!parsed.success || !parsed.data.path.startsWith(`${parsed.data.athleteId}/`)) return { ok: false };
  const session = await canManage(parsed.data.athleteId);
  if (!session) return { ok: false };
  const supabase = await createClient();
  // Comprobación en servidor del archivo ya subido: firma real y tamaño, no lo que declara el navegador.
  const { data: blob } = await supabase.storage.from('athlete-documents').download(parsed.data.path);
  const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  if (!bytes || !uploadMatches(bytes, { mime: parsed.data.mime, size: parsed.data.size })) {
    bestEffort(await supabase.storage.from('athlete-documents').remove([parsed.data.path]), 'storage.athlete-documents.remove');
    return { ok: false, reason: 'invalid_file' as const };
  }
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  const { data: prev } = await supabase.from('athlete_documents').select('storage_path').eq('id', parsed.data.id).maybeSingle();
  const { error } = await supabase.from('athlete_documents').update({
    storage_path: parsed.data.path, mime_type: parsed.data.mime, size_bytes: parsed.data.size,
    content_sha256: contentSha256, uploaded_by: session.userId, uploaded_at: new Date().toISOString(),
  }).eq('id', parsed.data.id).eq('athlete_id', parsed.data.athleteId);
  if (!error && prev?.storage_path && prev.storage_path !== parsed.data.path) {
    bestEffort(await supabase.storage.from('athlete-documents').remove([prev.storage_path]), 'storage.athlete-documents.remove');
  }
  if (!error) await logEvent('document_uploaded', { kind: 'file' });
  revalidatePath('/app/documents');
  return { ok: !error };
}

export async function removeDocumentFile(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), athlete_id: z.string().uuid() }).safeParse({ id: formData.get('id'), athlete_id: formData.get('athlete_id') });
  if (!parsed.success || !(await canManage(parsed.data.athlete_id))) return;
  const supabase = await createClient();
  const { data } = await supabase.from('athlete_documents').select('storage_path').eq('id', parsed.data.id).maybeSingle();
  if (data?.storage_path) bestEffort(await supabase.storage.from('athlete-documents').remove([data.storage_path]), 'storage.athlete-documents.remove');
  must(await supabase.from('athlete_documents').update({ storage_path: null, mime_type: null, size_bytes: null, content_sha256: null, uploaded_at: null, uploaded_by: null }).eq('id', parsed.data.id), 'athlete_documents.update');
  revalidatePath('/app/documents');
}

export async function addCustomDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({
    athlete_id: z.string().uuid(), kind: z.enum(DOC_KINDS), title: z.string().trim().min(2, 'Ponle un nombre').max(120),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  }).safeParse({ athlete_id: formData.get('athlete_id'), kind: formData.get('kind') || 'other', title: formData.get('title'), due_date: formData.get('due_date') ?? '' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await canManage(parsed.data.athlete_id))) return { error: 'No tienes permiso para editar los documentos de este atleta.' };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_documents').insert({ ...parsed.data, due_date: parsed.data.due_date || null });
  if (error) return { error: 'No se ha podido añadir.' };
  revalidatePath('/app/documents');
  return { ok: true, message: 'Añadido a la checklist.' };
}

// ---------------------------------------------------------------- Academias y clubes
export async function createRosterInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['coach', 'university']);
  const parsed = z.object({ organization_id: z.string().uuid(), season: z.string().regex(/^\d{4}-\d{2,4}$/, 'Temporada con formato 2026-27') })
    .safeParse({ organization_id: formData.get('organization_id'), season: formData.get('season') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('club_roster_invites').insert({ ...parsed.data, created_by: session.userId });
  if (error) return { error: 'Solo los administradores de un club o academia verificados pueden crear enlaces de roster.' };
  revalidatePath('/app/club');
  return { ok: true, message: 'Enlace creado. Compártelo con tus atletas: cada uno acepta y decide si comparte su progreso.' };
}

export async function revokeRosterInvite(formData: FormData) {
  await requireSession(['coach', 'university']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  must(await supabase.from('club_roster_invites').update({ status: 'revoked' }).eq('id', id.data), 'club_roster_invites.update');
  revalidatePath('/app/club');
}

export async function acceptRosterInvite(formData: FormData) {
  await requireSession(['athlete']);
  const token = z.string().regex(/^[a-f0-9]{64}$/).safeParse(formData.get('token'));
  if (!token.success) redirect('/app');
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_roster_invitation', { p_token: token.data, p_shares_progress: formData.get('shares_progress') === 'on' });
  if (error) redirect(`/roster/${token.data}?error=1`);
  await logEvent('roster_joined');
  redirect('/app/athlete?roster=1');
}

export async function verifyStatisticAsClub(formData: FormData) {
  await requireSession(['coach', 'university']);
  const parsed = z.object({ stat_id: z.string().uuid(), organization_id: z.string().uuid() }).safeParse({ stat_id: formData.get('stat_id'), organization_id: formData.get('organization_id') });
  if (!parsed.success) return;
  const supabase = await createClient();
  must(await supabase.rpc('club_verify_statistic', { p_stat: parsed.data.stat_id, p_org: parsed.data.organization_id }), 'rpc.club_verify_statistic');
  revalidatePath('/app/club');
}

export async function leaveRoster(formData: FormData) {
  const session = await requireSession(['athlete']);
  const parsed = z.object({ organization_id: z.string().uuid(), season: z.string() }).safeParse({ organization_id: formData.get('organization_id'), season: formData.get('season') });
  if (!parsed.success) return;
  const supabase = await createClient();
  must(await supabase.from('club_roster').update({ status: 'left' }).eq('athlete_id', session.userId).eq('organization_id', parsed.data.organization_id).eq('season', parsed.data.season), 'club_roster.update');
  revalidatePath('/app/athlete');
}

// ---------------------------------------------------------------- Baja autoservicio
export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Sesión caducada.' };
  if (formData.get('confirm') !== 'ELIMINAR') return { error: 'Escribe ELIMINAR en mayúsculas para confirmar.' };
  const supabase = await createClient();
  // Primero los archivos privados (la BD no puede borrar objetos de Storage).
  const { data: docs } = await supabase.from('athlete_documents').select('storage_path').eq('athlete_id', session.userId).not('storage_path', 'is', null);
  const paths = (docs ?? []).map((d) => d.storage_path as string);
  if (paths.length) bestEffort(await supabase.storage.from('athlete-documents').remove(paths), 'storage.athlete-documents.remove');
  // Fase 6 (S5): también las fotos del Passport y las evidencias de verificación (carpeta = id de la cuenta).
  for (const bucket of ['athlete-photos', 'verification-evidence'] as const) {
    const { data: files } = await supabase.storage.from(bucket).list(session.userId, { limit: 1000 });
    const own = (files ?? []).filter((f) => f.name && f.id).map((f) => `${session.userId}/${f.name}`);
    if (own.length) bestEffort(await supabase.storage.from(bucket).remove(own), `storage.${bucket}.remove`);
  }
  const { error } = await supabase.rpc('delete_my_account', { p_confirm: 'ELIMINAR' });
  if (error) {
    if (error.message.includes('transfer_organizations_first')) return { error: 'Antes de borrar tu cuenta, transfiere o cierra las organizaciones que creaste.' };
    if (error.message.includes('organization_staff')) return { error: 'Tu cuenta tiene contenido de una organización. Escríbenos desde Privacidad y datos y lo resolvemos en 30 días.' };
    return { error: 'No se ha podido completar la baja. Solicítala desde Privacidad y datos.' };
  }
  await supabase.auth.signOut();
  redirect('/?cuenta=eliminada');
}

// ---------------------------------------------------------------- Pago automático (Stripe Checkout)
/**
 * Crea una sesión de pago único. Si STRIPE_SECRET_KEY no está configurada, se usa el flujo de solicitud.
 * El derecho al plan lo concede el webhook (src/app/api/stripe/webhook/route.ts) al confirmarse el pago.
 */
export async function startCheckout(formData: FormData) {
  const session = await requireSession();
  const plan = planByCode(String(formData.get('plan_code') ?? ''));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!plan || !plan.checkoutCents || !key) redirect('/precios');
  // Contenido digital de entrega inmediata: consentimiento expreso y renuncia informada al desistimiento.
  if (formData.get('withdrawal_waiver') !== 'on') redirect('/precios?pago=consentimiento');
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const body = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(plan.checkoutCents),
    'line_items[0][price_data][product_data][name]': `The Gala Alliance · ${plan.name}`,
    client_reference_id: session.userId,
    'metadata[plan_code]': plan.code,
    'metadata[user_id]': session.userId,
    'metadata[withdrawal_waiver]': new Date().toISOString(),
    success_url: `${site}/app/plan?pago=ok`,
    cancel_url: `${site}/precios?pago=cancelado`,
    locale: 'es',
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const json = (await res.json()) as { url?: string };
  await logEvent('plan_requested', { plan: plan.code, channel: 'checkout' });
  redirect(json.url ?? '/precios?pago=error');
}

// ---------------------------------------------------------------- Admin
export async function runRetentionNow() {
  await requireAdmin('/app/admin/panel');
  const supabase = await createClient();
  must(await supabase.rpc('run_retention'), 'rpc.run_retention');
  revalidatePath('/app/admin/panel');
}

// ---------------------------------------------------------------- Ofertas recibidas fuera de la plataforma
const optionalInt = z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(0).max(200000).nullable());

export async function addExternalOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({
    athlete_id: z.string().uuid(),
    university_name: z.string().trim().min(2, 'Indica la universidad').max(200),
    annual_cost_usd: optionalInt,
    aid_amount_usd: optionalInt,
    renewable: z.enum(['yes', 'no', 'unknown']),
    in_writing: z.boolean(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
    source_text: z.string().trim().max(5000),
  }).safeParse({
    athlete_id: formData.get('athlete_id'), university_name: formData.get('university_name'),
    annual_cost_usd: formData.get('annual_cost_usd'), aid_amount_usd: formData.get('aid_amount_usd'),
    renewable: formData.get('renewable') ?? 'unknown', in_writing: formData.get('in_writing') === 'on',
    deadline: formData.get('deadline') ?? '', source_text: formData.get('source_text') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.aid_amount_usd != null && d.annual_cost_usd != null && d.aid_amount_usd > d.annual_cost_usd) return { error: 'La ayuda no puede superar el coste anual.' };
  if (!(await canManage(d.athlete_id))) return { error: 'No tienes permiso para editar las ofertas de este atleta.' };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_offers').insert({ ...d, deadline: d.deadline || null, source_text: d.source_text || null });
  if (error) return { error: error.message.includes('offers_limit') ? 'Máximo 20 ofertas por atleta.' : 'No se ha podido guardar la oferta.' };
  revalidatePath('/app/offers');
  return { ok: true, message: 'Oferta añadida al comparador.' };
}

export async function deleteExternalOffer(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid(), athlete_id: z.string().uuid() }).safeParse({ id: formData.get('id'), athlete_id: formData.get('athlete_id') });
  if (!parsed.success || !(await canManage(parsed.data.athlete_id))) return;
  const supabase = await createClient();
  must(await supabase.from('athlete_offers').delete().eq('id', parsed.data.id), 'athlete_offers.delete');
  revalidatePath('/app/offers');
}
