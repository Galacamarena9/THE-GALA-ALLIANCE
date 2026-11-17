'use server';

import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

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
    return error ? { ok: false, message: 'No se ha podido añadir.' } : { ok: true, message: 'Añadido a tu pipeline' };
  }
  const p = z.object({ title: z.string().trim().min(2).max(160), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(input);
  if (!p.success) return { ok: false, message: 'Tarea no válida.' };
  const { error } = await supabase.from('pipeline_tasks').insert({ athlete_id: session.userId, title: p.data.title, due_date: p.data.due_date ?? null });
  return error ? { ok: false, message: 'No se ha podido crear la tarea.' } : { ok: true, message: 'Tarea creada en tu pipeline' };
}
