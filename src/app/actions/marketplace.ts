'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

// ---------- Ofertas de marcas ----------
const campaignSchema = z
  .object({
    brand_org_id: z.string().uuid(),
    title: z.string().trim().min(4).max(160),
    description: z.string().trim().min(20, 'Describe la oferta (mín. 20 caracteres)').max(4000),
    kind: z.enum(['ambassador', 'social_content', 'event', 'product_testing', 'sponsorship']),
    deliverables: z.string().trim().min(5, 'Indica los entregables').max(2000),
    compensation_kind: z.enum(['product', 'fixed_fee', 'mixed', 'conditional', 'unknown']),
    compensation_usd: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000000)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    usage_rights: z.string().trim().max(1000).optional(),
    territory: z.string().trim().max(160).optional(),
    application_deadline: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
    // 13: términos estructurados (producto ≠ dinero; derechos de uso y exclusividad explícitos)
    product_description: z.string().trim().max(500).optional().transform((v) => v || null),
    product_value_usd: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000000)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    usage_months: z.union([z.literal(''), z.coerce.number().int().min(0).max(60)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    usage_channels: z.string().trim().max(200).optional().transform((v) => (v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 10)),
    paid_media: z.literal('on').optional().transform((v) => v === 'on'),
    exclusivity_category: z.string().trim().max(120).optional().transform((v) => v || null),
    exclusivity_days: z.union([z.literal(''), z.coerce.number().int().min(0).max(730)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    submit: z.enum(['draft', 'review']),
  })
  .refine((d) => ['product', 'conditional', 'unknown'].includes(d.compensation_kind) || d.compensation_usd != null, { message: 'Indica el importe', path: ['compensation_usd'] });

export async function createCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['brand']);
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { fieldErrors: fe, error: 'Revisa los campos marcados.' };
  }
  const sports = z.string().array().safeParse(formData.getAll('sport_ids'));
  const { submit, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from('brand_campaigns')
    .insert({ ...data, sport_ids: sports.success ? sports.data : [], created_by: session.userId, usage_rights: data.usage_rights || null, territory: data.territory || null, status: submit === 'review' ? 'pending_review' : 'draft' })
    .select('id')
    .single();
  if (error || !created) return { error: 'No se ha podido crear la oferta.' };
  revalidatePath('/app/campaigns');
  redirect(`/app/campaigns/${created.id}`);
}

export async function setCampaignStatus(formData: FormData) {
  await requireSession(['brand']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['pending_review', 'closed']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('brand_campaigns').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  revalidatePath(`/app/campaigns/${parsed.data.id}`);
}

export async function applyToCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  if (session.isMinor) return { error: 'Las ofertas de marcas son solo para mayores de 18 años.' };
  const parsed = z
    .object({ campaign_id: z.string().uuid(), message: z.string().trim().max(1500).optional(), rules_acknowledged: z.literal('on', { message: 'Debes confirmar que revisarás la normativa' }) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('campaign_applications').insert({
    campaign_id: parsed.data.campaign_id,
    athlete_id: session.userId,
    message: parsed.data.message || null,
    rules_acknowledged: true,
  });
  if (error) return { error: error.code === '23505' ? 'Ya has aplicado a esta oferta.' : 'No se ha podido aplicar.' };
  revalidatePath(`/app/campaigns/${parsed.data.campaign_id}`);
  return { ok: true, message: 'Candidatura enviada a la marca.' };
}

export async function moveCampaignApplication(formData: FormData) {
  await requireSession(['brand', 'athlete']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['shortlisted', 'selected', 'declined', 'withdrawn']), campaign_id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('campaign_applications').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  revalidatePath(`/app/campaigns/${parsed.data.campaign_id}`);
}

// ---------- Representación de agentes ----------
export async function requestRepresentation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = z
    .object({ agency_id: z.string().uuid(), athlete_id: z.string().uuid(), message: z.string().trim().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  // Propuesta por defecto, prudente: el deporte del atleta, sin exclusividad, 12 meses y solo lo necesario para
  // trabajar su proceso. El atleta (o su familia) ve el alcance exacto y puede recortarlo antes y después de aceptar.
  const { data: dir } = await supabase.from('athlete_directory').select('sport_id').eq('user_id', parsed.data.athlete_id).maybeSingle();
  const end = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const { error } = await supabase.rpc('representation_request', {
    p_agency: parsed.data.agency_id,
    p_athlete: parsed.data.athlete_id,
    p_type: 'non_exclusive',
    p_sports: [dir?.sport_id ?? 'basketball'],
    p_territories: ['WORLD'],
    p_categories: ['university', 'club', 'academy'],
    p_permissions: ['passport.view', 'opportunities.manage', 'pipeline.view', 'pipeline.manage', 'tasks.manage', 'deadlines.manage', 'messages.participate'],
    p_end: end,
    p_message: parsed.data.message || null,
  });
  if (error) {
    if (error.message.includes('agency_not_verified')) return { error: 'Tu agencia tiene que estar verificada para proponer representaciones.' };
    if (error.message.includes('not_found')) return { error: 'Este perfil no está disponible para agencias.' };
    if (error.message.includes('blocked')) return { error: 'No es posible contactar con este atleta.' };
    return { error: 'No se ha podido enviar la solicitud.' };
  }
  revalidatePath('/app/portfolio');
  return { ok: true, message: 'Propuesta enviada: no exclusiva, 12 meses. El atleta ve el alcance y decide.' };
}

/** Lado del atleta (o de su familia si es menor): aceptar, rechazar o revocar. Todo pasa por funciones de la base de datos. */
export async function respondRepresentation(formData: FormData) {
  await requireSession(['athlete', 'agent', 'parent']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['active', 'declined', 'ended', 'guardian_approve', 'guardian_decline']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { id, status } = parsed.data;
  if (status === 'active' || status === 'declined') await supabase.rpc('representation_respond', { p_id: id, p_accept: status === 'active' });
  else if (status === 'guardian_approve' || status === 'guardian_decline') await supabase.rpc('representation_guardian_decide', { p_id: id, p_approve: status === 'guardian_approve' });
  else await supabase.rpc('representation_end', { p_id: id });
  revalidatePath('/app/agents');
  revalidatePath('/app/portfolio');
  revalidatePath('/app/family/safety');
}

/** El atleta o su familia invitan a una agencia verificada a enviar UNA propuesta (30 días). Es la vía de los menores. */
export async function inviteAgency(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete', 'parent']);
  const parsed = z.object({ agency_id: z.string().uuid(), athlete_id: z.string().uuid().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Elige una agencia.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('representation_invite', { p_agency: parsed.data.agency_id, p_athlete: parsed.data.athlete_id ?? session.userId });
  if (error) return { error: error.message.includes('agency_not_verified') ? 'Esa agencia no está verificada.' : 'No se ha podido enviar la invitación.' };
  revalidatePath('/app/agents');
  revalidatePath('/app/family/safety');
  return { ok: true, message: 'Invitación enviada. La agencia tiene 30 días para mandaros su propuesta; nada se activa sin vuestra aprobación.' };
}

/** El atleta (o su familia) decide qué puede hacer la agencia. Quitar un permiso tiene efecto inmediato. */
export async function setRepresentationPermissions(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['athlete', 'parent']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return { error: 'Solicitud no válida.' };
  const perms = formData.getAll('permission').map(String).filter((p) => /^[a-z_]+\.[a-z_]+$/.test(p));
  const supabase = await createClient();
  const { error } = await supabase.rpc('representation_set_permissions', { p_id: id.data, p_permissions: perms });
  if (error) return { error: 'No se han podido guardar los permisos.' };
  revalidatePath('/app/agents');
  revalidatePath('/app/family/safety');
  return { ok: true, message: 'Permisos actualizados. Se aplican ya.' };
}

// ---------- Enlaces verificables del atleta ----------
export async function addAthleteLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = z
    .object({
      kind: z.enum(['club_profile', 'federation_stats', 'ranking', 'highlight_video', 'school', 'social']),
      url: z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/, 'El enlace debe empezar por https://'),
      label: z.string().trim().max(120).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_links').insert({ ...parsed.data, label: parsed.data.label || null, athlete_id: session.userId });
  if (error) return { error: 'No se ha podido guardar el enlace.' };
  revalidatePath('/app/athlete/passport');
  return { ok: true, message: 'Enlace añadido (pendiente de verificación).' };
}

export async function deleteAthleteLink(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('athlete_links').delete().eq('id', id).eq('athlete_id', session.userId);
  revalidatePath('/app/athlete/passport');
}
