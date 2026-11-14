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
    compensation_kind: z.enum(['product', 'fixed_fee', 'mixed']),
    compensation_usd: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000000)]).optional().transform((v) => (v === '' || v == null ? null : v)),
    usage_rights: z.string().trim().max(1000).optional(),
    territory: z.string().trim().max(160).optional(),
    application_deadline: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null),
    submit: z.enum(['draft', 'review']),
  })
  .refine((d) => d.compensation_kind === 'product' || d.compensation_usd != null, { message: 'Indica el importe', path: ['compensation_usd'] });

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
  const session = await requireSession(['agent']);
  const parsed = z
    .object({ agency_id: z.string().uuid(), athlete_id: z.string().uuid(), message: z.string().trim().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.from('agent_representations').insert({ ...parsed.data, agent_id: session.userId, message: parsed.data.message || null });
  if (error) {
    if (error.code === '23505') return { error: 'Ya hay una solicitud o representación activa con este atleta.' };
    if (error.message.includes('adults_only')) return { error: 'La representación solo está disponible con atletas mayores de edad.' };
    return { error: 'No se ha podido enviar la solicitud.' };
  }
  revalidatePath('/app/portfolio');
  return { ok: true, message: 'Solicitud enviada. El atleta decide si acepta.' };
}

export async function respondRepresentation(formData: FormData) {
  const session = await requireSession(['athlete', 'agent']);
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['active', 'declined', 'ended']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  // Defensa en profundidad (además del trigger y la RLS): aceptar o rechazar solo lo hace el propio
  // atleta sobre una propuesta pendiente; terminar solo aplica a una representación activa.
  let q = supabase.from('agent_representations').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  q = parsed.data.status === 'ended' ? q.eq('status', 'active') : q.eq('athlete_id', session.userId).eq('status', 'requested');
  await q;
  revalidatePath('/app/agents');
  revalidatePath('/app/portfolio');
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
