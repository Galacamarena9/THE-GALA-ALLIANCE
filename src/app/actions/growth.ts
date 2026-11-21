'use server';

import { logEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { TALENT_FILTER_KEYS, parseTalentFilters } from '@/lib/domain/talent-search';
import { DIRECTORY_DIVISIONS } from '@/lib/data/directory';
import { createClient } from '@/lib/supabase/server';
import { getSession, requireSession } from '@/lib/session';
import type { FormState } from '@/app/actions/auth';
import { TOPICS } from '@/content/academy';
import { planByCode } from '@/content/plans';

// ---------------------------------------------------------------- Academia
const topicIds = new Set(TOPICS.map((t) => t.id));

export async function toggleAcademyTopic(formData: FormData) {
  const session = await requireSession();
  const parsed = z.object({ exam: z.enum(['sat', 'toefl']), topic_id: z.string(), done: z.enum(['0', '1']) }).safeParse({
    exam: formData.get('exam'), topic_id: formData.get('topic_id'), done: formData.get('done'),
  });
  if (!parsed.success || !topicIds.has(parsed.data.topic_id)) return;
  const supabase = await createClient();
  if (parsed.data.done === '1') {
    await supabase.from('academy_progress').delete().eq('user_id', session.userId).eq('exam', parsed.data.exam).eq('topic_id', parsed.data.topic_id);
  } else {
    await supabase.from('academy_progress').upsert({ user_id: session.userId, exam: parsed.data.exam, topic_id: parsed.data.topic_id }, { ignoreDuplicates: true });
  }
  revalidatePath('/app/academia');
}

export async function saveAcademyAttempt(input: { exam: 'sat' | 'toefl'; correct: number; total: number; durationSeconds: number }) {
  const session = await getSession();
  if (!session) return { ok: false };
  const parsed = z.object({
    exam: z.enum(['sat', 'toefl']),
    correct: z.number().int().min(0).max(50),
    total: z.number().int().min(1).max(50),
    durationSeconds: z.number().int().min(0).max(36000),
  }).refine((v) => v.correct <= v.total).safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from('academy_attempts').insert({
    user_id: session.userId, exam: parsed.data.exam, correct: parsed.data.correct, total: parsed.data.total,
    duration_seconds: parsed.data.durationSeconds,
  });
  if (!error) await logEvent('academy_attempt', { exam: parsed.data.exam });
  revalidatePath('/app/academia');
  return { ok: !error };
}

// ---------------------------------------------------------------- Búsquedas guardadas

export async function saveSearch(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const label = z.string().trim().min(2, 'Ponle un nombre (mín. 2 caracteres)').max(80).safeParse(formData.get('label'));
  if (!label.success) return { error: label.error.issues[0].message };
  // Misma validación que la búsqueda: solo claves y valores permitidos (la base de datos vuelve a comprobar las claves).
  const raw: Record<string, string> = {};
  for (const k of TALENT_FILTER_KEYS) {
    const v = formData.get(k);
    if (typeof v === 'string') raw[k] = v;
  }
  const filters = parseTalentFilters(raw, DIRECTORY_DIVISIONS);
  if (!Object.keys(filters).length) return { error: 'Aplica al menos un filtro antes de guardar la búsqueda.' };
  const supabase = await createClient();
  const { error } = await supabase.from('saved_searches').insert({ owner_id: session.userId, label: label.data, filters });
  if (error) {
    if (error.message.includes('saved_search_limit')) return { error: 'Has llegado al máximo de 25 búsquedas guardadas.' };
    if (error.code === '23505') return { error: 'Ya tienes una búsqueda con ese nombre.' };
    return { error: 'No se ha podido guardar la búsqueda.' };
  }
  revalidatePath('/app/lists');
  await logEvent('search_saved');
  return { ok: true, message: 'Búsqueda guardada. Te avisaremos de perfiles nuevos en Listas.' };
}

export async function deleteSearch(formData: FormData) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('saved_searches').delete().eq('id', id.data).eq('owner_id', session.userId);
  revalidatePath('/app/lists');
}

export async function markSearchSeen(formData: FormData) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('saved_searches').update({ last_seen_at: new Date().toISOString() }).eq('id', id.data).eq('owner_id', session.userId);
  revalidatePath('/app/lists');
}

// ---------------------------------------------------------------- Novedades del atleta
const updateSchema = z.object({
  kind: z.enum(['result', 'stat', 'video', 'academic', 'availability', 'other']),
  body: z.string().trim().min(3, 'Escribe al menos 3 caracteres').max(280, 'Máximo 280 caracteres'),
  link_url: z.string().trim().url('Enlace no válido').startsWith('https://', 'El enlace debe empezar por https://').max(500).optional().or(z.literal('')),
});

export async function postAthleteUpdate(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['athlete']);
  const parsed = updateSchema.safeParse({ kind: formData.get('kind'), body: formData.get('body'), link_url: formData.get('link_url') ?? '' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('athlete_updates').insert({
    athlete_id: session.userId, kind: parsed.data.kind, body: parsed.data.body, link_url: parsed.data.link_url || null,
  });
  if (error) {
    if (error.message.includes('contact_data_not_allowed')) return { error: 'Por seguridad, los menores no pueden publicar emails, teléfonos ni redes sociales.' };
    if (error.message.includes('rate_limited')) return { error: 'Has publicado muchas novedades hoy. Vuelve mañana.' };
    return { error: 'No se ha podido publicar. ¿Has completado tu Passport?' };
  }
  revalidatePath('/app/athlete/passport');
  return { ok: true, message: 'Publicada. La verán quienes pueden ver tu perfil durante 30 días.' };
}

export async function deleteAthleteUpdate(formData: FormData) {
  const session = await requireSession(['athlete']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('athlete_updates').delete().eq('id', id.data).eq('athlete_id', session.userId);
  revalidatePath('/app/athlete/passport');
}

// ---------------------------------------------------------------- Notificaciones
export async function markNotificationsRead() {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session.userId).is('read_at', null);
  revalidatePath('/app', 'layout');
}

// ---------------------------------------------------------------- Planes y servicios
export async function requestPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Inicia sesión o crea tu cuenta gratis para solicitarlo.' };
  const plan = planByCode(String(formData.get('plan_code') ?? ''));
  if (!plan || plan.cta === 'signup') return { error: 'Plan no válido.' };
  const parsed = z.object({
    message: z.string().trim().max(1000).optional(),
    organization_id: z.string().uuid().optional().or(z.literal('')),
  }).safeParse({ message: formData.get('message') ?? undefined, organization_id: formData.get('organization_id') ?? '' });
  if (!parsed.success) return { error: 'Revisa el mensaje (máx. 1.000 caracteres).' };
  const supabase = await createClient();
  const { error } = await supabase.from('service_requests').insert({
    user_id: session.userId, plan_code: plan.code, message: parsed.data.message || null,
    organization_id: parsed.data.organization_id || null,
  });
  if (error) {
    if (error.message.includes('rate_limited')) return { error: 'Ya has enviado varias solicitudes hoy. Te contactaremos pronto.' };
    return { error: 'No se ha podido enviar la solicitud.' };
  }
  await logEvent('plan_requested', { plan: plan.code, channel: 'request' });
  return { ok: true, message: `Solicitud de ${plan.name} recibida. Te escribiremos para cerrar el alcance; no se te cobrará nada sin tu confirmación por escrito.` };
}

export async function updateServiceRequest(formData: FormData) {
  const session = await requireSession(['admin']);
  if (!session.roles.includes('admin')) return;
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(['new', 'contacted', 'won', 'lost']),
    admin_note: z.string().trim().max(1000).optional(),
  }).safeParse({ id: formData.get('id'), status: formData.get('status'), admin_note: formData.get('admin_note') ?? undefined });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('service_requests').update({ status: parsed.data.status, admin_note: parsed.data.admin_note || null }).eq('id', parsed.data.id);
  revalidatePath('/app/admin');
}

// ---------------------------------------------------------------- Feedback del piloto
export async function sendFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = z.object({
    message: z.string().trim().min(3, 'Cuéntanos un poco más').max(2000),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    page: z.string().max(200).optional(),
  }).safeParse({ message: formData.get('message'), rating: formData.get('rating') || undefined, page: formData.get('page') || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from('user_feedback').insert({ user_id: session.userId, ...parsed.data });
  if (error) return { error: 'No se ha podido enviar.' };
  return { ok: true, message: 'Gracias. Lo leemos todo.' };
}
