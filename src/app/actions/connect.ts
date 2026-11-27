'use server';

import { redirect } from 'next/navigation';
import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';
import { getT } from '@/lib/i18n/server-t';

const ERRORS: Record<string, string> = {
  verified_organization_required: 'Tu organización debe estar verificada para contactar atletas.',
  guardian_required: 'Este atleta es menor y aún no tiene a su familia vinculada: no es posible contactarle todavía.',
  rate_limited: 'Has alcanzado el límite diario. Inténtalo mañana.',
  contact_data_not_allowed_with_minors: 'Con menores no se pueden compartir emails, teléfonos ni redes sociales. Todo queda dentro de la plataforma.',
  conversation_not_open: 'La conversación aún no está abierta.',
  conversation_frozen_no_guardian: 'Conversación en pausa: el atleta es menor y ahora mismo no tiene un tutor activo. Se reanudará cuando su familia vuelva a estar activa.',
  ncaa_contact_window_closed: 'Normas NCAA: vuestra universidad aún no puede iniciar contacto con este atleta por su curso. Guárdalo en una lista y escríbele cuando se abra la ventana.',
};
const friendly = (msg: string, fallback: string) => Object.entries(ERRORS).find(([k]) => msg.includes(k))?.[1] ?? fallback;

export async function requestContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const parsed = z
    .object({ organization_id: z.string().uuid(), athlete_id: z.string().uuid(), message: z.string().trim().min(20, 'Mínimo 20 caracteres').max(1500) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('contact_requests').insert({ ...parsed.data, requested_by: session.userId });
  if (error) {
    if (error.code === '23505') return { error: 'Ya tienes una solicitud abierta con este atleta.' };
    return { error: friendly(error.message, 'No se ha podido enviar la solicitud.') };
  }
  await logEvent('contact_requested');
  revalidatePath('/app/inbox');
  return { ok: true, message: 'Solicitud enviada. El atleta (y su familia si es menor) decidirá si acepta.' };
}

export async function respondContact(formData: FormData) {
  await requireSession();
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(['pending', 'accepted', 'declined', 'blocked']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from('contact_requests').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  if (error?.message.includes('guardian_verification_required')) redirect('/app/family?verificar=1');
  if (!error && parsed.data.status === 'accepted') await logEvent('contact_accepted');
  revalidatePath('/app/inbox');
}

export async function sendMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = z.object({ request_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Mensaje no válido.' };
  const supabase = await createClient();
  const { error } = await supabase.from('contact_messages').insert(parsed.data);
  if (error) {
    const tx = await getT();
    return { error: tx(friendly(error.message, 'No se ha podido enviar el mensaje.')) };
  }
  revalidatePath(`/app/inbox/${parsed.data.request_id}`);
  return { ok: true };
}

/**
 * «Esto me incomoda» (QA familia, idea 5): el atleta marca la conversación. La base de datos crea una denuncia de
 * seguridad (prioridad máxima si es menor) y avisa a sus tutores activos. No desvincula ni bloquea a nadie.
 */
export async function flagDiscomfort(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['athlete']);
  const tx = await getT();
  const parsed = z.object({ request_id: z.string().uuid(), note: z.string().trim().max(500).optional() })
    .safeParse({ request_id: formData.get('request_id'), note: formData.get('note') || undefined });
  if (!parsed.success) return { error: tx('No se ha podido enviar el aviso.') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('contact_flag_discomfort', { p_request: parsed.data.request_id, p_note: parsed.data.note });
  if (error) return { error: tx('No se ha podido enviar el aviso. Si hay un riesgo inmediato, llama al 112.') };
  const n = Number(data ?? 0);
  return {
    ok: true,
    message: n === -1 ? tx('Ya nos lo habías dicho: el equipo de seguridad lo está revisando.')
      : n > 0 ? tx('Gracias por decirlo. Hemos avisado a tu familia y al equipo de seguridad de Gala.')
      : tx('Gracias por decirlo. El equipo de seguridad de Gala lo revisará con prioridad.'),
  };
}

const REASONS = ['child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other',
  'impersonation', 'unauthorized_representation', 'misleading_fees', 'payment_request', 'unauthorized_document_use',
  'false_guarantee', 'incorrect_cost'] as const;
const ENTITIES = ['athlete_profile', 'opportunity', 'campaign', 'organization', 'contact_request', 'news_post', 'institution', 'athlete_update'] as const;

export async function reportContent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = z
    .object({ entity_type: z.enum(ENTITIES), entity_id: z.string().uuid(), reason: z.enum(REASONS), details: z.string().trim().max(2000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Denuncia no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.from('content_reports').insert({ ...parsed.data, details: parsed.data.details || null });
  if (error) return { error: 'No se ha podido enviar la denuncia.' };
  return { ok: true, message: 'Gracias. Nuestro equipo la revisará; las de seguridad infantil tienen prioridad máxima.' };
}

/**
 * «Mensaje» desde la ficha 360 (QA agente, hallazgo 4): abre la conversación de la agencia con su atleta y, si aún no
 * existe, la crea con el primer mensaje que escribe el agente. Solo con representación activa que incluya
 * `messages.participate`; con un menor la solicitud pasa por su familia (lo decide la base de datos, no esta acción).
 */
export async function openAgencyThread(formData: FormData) {
  const session = await requireSession(['agent']);
  const parsed = z.object({ athlete_id: z.string().uuid(), message: z.string().trim().max(1500).optional() }).safeParse({
    athlete_id: formData.get('athlete_id'), message: formData.get('message') ?? undefined,
  });
  if (!parsed.success) redirect('/app/portfolio');
  const { athlete_id, message } = parsed.data;
  const compose = (error?: string) => `/app/inbox/nuevo?atleta=${athlete_id}${error ? `&error=${error}` : ''}`;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('agent_can', { p_athlete: athlete_id, p_permission: 'messages.participate' });
  if (!allowed) redirect(compose('sin_permiso'));
  const { data: reps } = await supabase.from('agent_representations').select('agency_id').eq('athlete_id', athlete_id).eq('status', 'active');
  const agencyIds = [...new Set(((reps ?? []) as { agency_id: string }[]).map((r) => r.agency_id))];
  if (!agencyIds.length) redirect(compose('sin_permiso'));
  const { data: open } = await supabase.from('contact_requests').select('id')
    .eq('athlete_id', athlete_id).in('organization_id', agencyIds).in('status', ['pending_guardian', 'pending', 'accepted'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (open?.id) redirect(`/app/inbox/${open.id}`);
  if (!message) redirect(compose());
  if (message.length < 20) redirect(compose('corto'));
  const { data: created, error } = await supabase.from('contact_requests')
    .insert({ organization_id: agencyIds[0], athlete_id, message, requested_by: session.userId }).select('id').single();
  if (error || !created) {
    const code = error?.code === '23505' ? 'abierta' : Object.keys(ERRORS).find((k) => error?.message.includes(k)) ?? 'error';
    redirect(compose(code));
  }
  await logEvent('contact_requested', { source: 'athlete_360' });
  revalidatePath('/app/inbox');
  redirect(`/app/inbox/${created.id}`);
}
