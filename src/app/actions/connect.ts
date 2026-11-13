'use server';

import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

const ERRORS: Record<string, string> = {
  verified_organization_required: 'Tu organización debe estar verificada para contactar atletas.',
  guardian_required: 'Este atleta es menor y aún no tiene a su familia vinculada: no es posible contactarle todavía.',
  rate_limited: 'Has alcanzado el límite diario. Inténtalo mañana.',
  contact_data_not_allowed_with_minors: 'Con menores no se pueden compartir emails, teléfonos ni redes sociales. Todo queda dentro de la plataforma.',
  conversation_not_open: 'La conversación aún no está abierta.',
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
  if (!error && parsed.data.status === 'accepted') await logEvent('contact_accepted');
  revalidatePath('/app/inbox');
}

export async function sendMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = z.object({ request_id: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Mensaje no válido.' };
  const supabase = await createClient();
  const { error } = await supabase.from('contact_messages').insert(parsed.data);
  if (error) return { error: friendly(error.message, 'No se ha podido enviar el mensaje.') };
  revalidatePath(`/app/inbox/${parsed.data.request_id}`);
  return { ok: true };
}

const REASONS = ['child_safety', 'harassment', 'fake_or_misleading', 'spam', 'illegal_content', 'privacy', 'other'] as const;
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
