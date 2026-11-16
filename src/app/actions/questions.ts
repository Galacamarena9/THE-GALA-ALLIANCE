'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from '@/app/actions/auth';

const ERR: Record<string, string> = {
  contact_data_not_allowed: 'Es un espacio público: no incluyas emails, teléfonos ni redes sociales.',
  rate_limited: 'Has hecho muchas preguntas hoy. Vuelve a intentarlo mañana.',
  opportunity_not_published: 'Esta beca ya no está publicada.',
  answer_not_allowed: 'Solo la organización que publica la beca puede responder.',
};
const msg = (m?: string) => Object.entries(ERR).find(([k]) => m?.includes(k))?.[1] ?? 'No se ha podido enviar. Inténtalo de nuevo.';

const ask = z.object({ opportunity_id: z.string().uuid(), body: z.string().trim().min(10, 'Escribe la pregunta con un poco más de detalle.').max(500) });

export async function askQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = ask.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('opportunity_questions').insert(parsed.data);
  if (error) return { error: msg(error.message) };
  revalidatePath(`/app/opportunities/${parsed.data.opportunity_id}`);
  return { ok: true, message: 'Pregunta enviada. Te avisaremos cuando respondan; la respuesta será visible para todos.' };
}

const answer = z.object({ id: z.string().uuid(), opportunity_id: z.string().uuid(), answer: z.string().trim().min(2).max(1500) });

export async function answerQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = answer.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Escribe una respuesta.' };
  const supabase = await createClient();
  const { error } = await supabase.from('opportunity_questions').update({ answer: parsed.data.answer }).eq('id', parsed.data.id);
  if (error) return { error: msg(error.message) };
  revalidatePath(`/app/opportunities/${parsed.data.opportunity_id}`);
  return { ok: true, message: 'Respondida. Ya es visible para todos.' };
}
