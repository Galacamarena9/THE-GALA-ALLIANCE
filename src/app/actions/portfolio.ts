'use server';

import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { friendlyDbError } from '@/lib/domain/portfolio';
import type { FormState } from './auth';

/*
 * Acciones del Agent Workspace. La seguridad real está en la base de datos
 * (RLS de agency_athlete_notes y guard_agent_representation); aquí además se filtra
 * explícitamente por autor, agencia y estado para no depender solo de la RLS y para
 * devolver mensajes claros.
 */

const uuid = z.string().uuid();
const isoDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null);

function refresh(athleteId?: string) {
  revalidatePath('/app/portfolio');
  revalidatePath('/app');
  if (athleteId) revalidatePath(`/app/portfolio/${athleteId}`);
}

const noteSchema = z.object({
  agency_id: uuid,
  athlete_id: uuid,
  kind: z.enum(['note', 'follow_up']),
  body: z.string().trim().min(1, 'Escribe la nota').max(5000, 'Máximo 5.000 caracteres'),
  due_date: isoDate,
});

export async function addAgencyNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['agent']);
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa la nota.' };
  const { kind, due_date, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('agency_athlete_notes').insert({
    ...rest,
    kind,
    due_date: kind === 'follow_up' ? due_date : null,
    author_id: session.userId,
  });
  if (error) return { error: friendlyDbError(error.message) };
  refresh(rest.athlete_id);
  return { ok: true, message: kind === 'follow_up' ? 'Seguimiento programado' : 'Nota guardada' };
}

export async function updateAgencyNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['agent']);
  const parsed = z
    .object({ id: uuid, athlete_id: uuid, body: z.string().trim().min(1, 'La nota no puede quedar vacía').max(5000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agency_athlete_notes')
    .update({ body: parsed.data.body })
    .eq('id', parsed.data.id)
    .eq('author_id', session.userId)
    .select('id');
  if (error) return { error: friendlyDbError(error.message) };
  if (!data?.length) return { error: 'Solo quien escribió la nota puede editarla.' };
  refresh(parsed.data.athlete_id);
  return { ok: true, message: 'Nota actualizada' };
}

export async function toggleFollowUp(formData: FormData) {
  const session = await requireSession(['agent']);
  const parsed = z
    .object({ id: uuid, athlete_id: uuid, done: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  must(await supabase
    .from('agency_athlete_notes')
    .update({ done: parsed.data.done === 'true' })
    .eq('id', parsed.data.id)
    .eq('author_id', session.userId)
    .eq('kind', 'follow_up'), 'agency_athlete_notes.update');
  refresh(parsed.data.athlete_id);
}

export async function deleteAgencyNote(formData: FormData) {
  const session = await requireSession(['agent']);
  const parsed = z.object({ id: uuid, athlete_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  must(await supabase.from('agency_athlete_notes').delete().eq('id', parsed.data.id).eq('author_id', session.userId), 'agency_athlete_notes.delete');
  refresh(parsed.data.athlete_id);
}

/**
 * Lado de la agencia: retirar una propuesta pendiente o terminar una representación activa.
 * Aceptar o rechazar es exclusivo del atleta y no existe aquí.
 */
export async function endRepresentation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = z
    .object({ id: uuid, agency_id: uuid, athlete_id: uuid, from: z.enum(['requested', 'active']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { data: current } = await supabase.from('agent_representations').select('status').eq('id', parsed.data.id).eq('agency_id', parsed.data.agency_id).maybeSingle();
  const group = current?.status === 'active' || current?.status === 'suspended' || current?.status === 'disputed' ? 'active'
    : current?.status === 'requested' || current?.status === 'pending_guardian' || current?.status === 'pending_review' ? 'requested' : null;
  if (group !== parsed.data.from) return { error: 'El estado ha cambiado mientras tanto. Recarga la página.' };
  const { error } = await supabase.rpc('representation_end', { p_id: parsed.data.id });
  if (error) return { error: friendlyDbError(error.message) };
  refresh(parsed.data.athlete_id);
  revalidatePath('/app/agents');
  return { ok: true, message: parsed.data.from === 'requested' ? 'Propuesta retirada' : 'Representación finalizada' };
}
