'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { stampMatchAtSave } from '@/lib/data/gala-match';

/** Feedback sobre una respuesta de Gala AI: útil / no útil y motivo. No guarda el contenido. */
export async function sendAiFeedback(input: { requestId: string; rating: 1 | -1; reason?: string }) {
  const session = await requireSession();
  const p = z.object({
    requestId: z.string().uuid(), rating: z.union([z.literal(1), z.literal(-1)]),
    reason: z.enum(['wrong', 'not_useful', 'unsafe', 'outdated', 'too_long', 'other', 'helpful']).optional(),
  }).safeParse(input);
  if (!p.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from('ai_feedback').upsert({ request_id: p.data.requestId, user_id: session.userId, rating: p.data.rating, reason: p.data.reason ?? null });
  return { ok: !error };
}

/**
 * Ejecuta una acción que Gala AI PROPUSO, solo tras la confirmación explícita del usuario en la interfaz.
 * Se vuelve a validar todo aquí (y la base de datos aplica RLS): la IA nunca ejecuta nada por sí sola.
 */
export async function confirmAiProposal(input: { kind: 'add_to_pipeline' | 'create_task'; target_kind?: 'institution' | 'opportunity'; target_id?: string; title?: string; due_date?: string; confirmed: boolean }) {
  const session = await requireSession(['athlete']);
  if (input.confirmed !== true) return { ok: false, message: 'Falta tu confirmación.' };
  const supabase = await createClient();
  if (input.kind === 'add_to_pipeline') {
    const p = z.object({ target_kind: z.enum(['institution', 'opportunity']), target_id: z.string().uuid() }).safeParse(input);
    if (!p.success) return { ok: false, message: 'Datos no válidos.' };
    const { error } = await supabase.from('saved_items').upsert({ athlete_id: session.userId, target_kind: p.data.target_kind, target_id: p.data.target_id }, { onConflict: 'athlete_id,target_kind,target_id', ignoreDuplicates: true });
    if (error) return { ok: false, message: 'No se ha podido añadir.' };
    await stampMatchAtSave(session.userId, p.data.target_kind, p.data.target_id);
    return { ok: true, message: 'Añadido a tu pipeline' };
  }
  const p = z.object({ title: z.string().trim().min(2).max(160), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Tarea no válida.' };
  const { error } = await supabase.from('pipeline_tasks').insert({ athlete_id: session.userId, title: p.data.title, due_date: p.data.due_date ?? null });
  return error ? { ok: false, message: 'No se ha podido crear la tarea.' } : { ok: true, message: 'Tarea creada en tu pipeline' };
}

/** Preferencias de Gala AI: idioma, estilo e historial (opcional). Desactivar el historial lo borra (trigger en BD). */
export async function saveAiPreferences(formData: FormData) {
  const session = await requireSession();
  const p = z.object({
    language: z.enum(['auto', 'es', 'en']),
    answer_style: z.enum(['short', 'detailed']),
    save_history: z.enum(['on', 'off']).optional(),
  }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('ai_preferences').upsert({ user_id: session.userId, language: p.language, answer_style: p.answer_style, save_history: p.save_history === 'on' });
  revalidatePath('/app/ia');
}

/** Borra una conversación guardada (RLS: solo las propias). */
export async function deleteAiConversation(formData: FormData) {
  await requireSession();
  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  await supabase.from('ai_conversations').delete().eq('id', id);
  revalidatePath('/app/ia');
  redirect('/app/ia');
}

/** Borra todo el historial guardado sin desactivarlo. */
export async function deleteAllAiConversations() {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase.from('ai_conversations').delete().eq('user_id', session.userId);
  revalidatePath('/app/ia');
  redirect('/app/ia');
}
