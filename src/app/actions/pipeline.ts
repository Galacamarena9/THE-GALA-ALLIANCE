'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { stampMatchAtSave } from '@/lib/data/gala-match';
import { managedAthletes } from '@/lib/data/family';
import { logEvent } from '@/lib/events';
import { STAGES } from '@/lib/domain/pipeline';
import type { FormState } from './auth';

const uuid = z.string().uuid();
const optDate = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => (v ? v : null));

/** El atleta o un familiar con permiso de edición. La base de datos lo vuelve a comprobar (RLS). */
async function editableAthlete(formData: FormData) {
  const session = await requireSession(['athlete', 'parent']);
  const wanted = (formData.get('athlete') as string | null) || session.userId;
  const list = await managedAthletes(session);
  const a = list.find((x) => x.id === wanted && x.canEdit);
  if (!a) throw new Error('not_allowed');
  return a.id;
}

function refresh(processId?: string) {
  revalidatePath('/app/process');
  if (processId) revalidatePath(`/app/process/${processId}`);
  revalidatePath('/app');
}

const stageInput = z.object({
  id: uuid,
  status: z.enum(STAGES),
  close_reason: z.enum(['not_interested', 'rejected', 'declined_offer', 'opportunity_closed', 'other']).optional(),
  confirm: z.string().optional(),
});

/** Cambiar de etapa. Comprometerse o cerrar exige confirmación explícita. */
export async function moveStage(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const parsed = stageInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Datos no válidos.' };
  const t = parsed.data;
  if ((t.status === 'committed' || t.status === 'closed') && t.confirm !== 'yes') {
    return { error: t.status === 'committed' ? 'Confirma que esta es tu decisión final.' : 'Confirma que quieres cerrar este proceso.' };
  }
  if (t.status === 'closed' && !t.close_reason) return { fieldErrors: { close_reason: 'Elige un motivo' }, error: 'Indica por qué se cierra.' };
  const supabase = await createClient();
  const { error } = await supabase.from('saved_items')
    .update({ status: t.status, close_reason: t.status === 'closed' ? t.close_reason : null })
    .eq('id', t.id).eq('athlete_id', athlete);
  if (error) return { error: error.code === '23505' ? 'Ya tienes otro compromiso activo. Ciérralo o archívalo antes.' : 'No se ha podido mover el proceso.' };
  await logEvent(t.status === 'committed' || t.status === 'closed' ? 'pipeline_decision' : 'pipeline_stage_changed', { stage: t.status });
  refresh(t.id);
  return { ok: true, message: 'Etapa actualizada' };
}

/** Versión rápida (tablero): solo etapas no definitivas. */
export async function quickMove(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ id: uuid, status: z.enum(['discovered', 'saved', 'applied', 'contacted', 'call', 'offer', 'decision']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('saved_items').update({ status: t.status }).eq('id', t.id).eq('athlete_id', athlete);
  await logEvent('pipeline_stage_changed', { stage: t.status });
  refresh(t.id);
}

export async function setNextAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const parsed = z.object({ id: uuid, next_action: z.string().trim().max(200), next_action_due: optDate }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Revisa el siguiente paso (máx. 200 caracteres).' };
  const supabase = await createClient();
  await supabase.from('saved_items').update({ next_action: parsed.data.next_action || null, next_action_due: parsed.data.next_action ? parsed.data.next_action_due : null }).eq('id', parsed.data.id).eq('athlete_id', athlete);
  refresh(parsed.data.id);
  return { ok: true, message: 'Siguiente paso guardado' };
}

export async function setArchived(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ id: uuid, archive: z.enum(['1', '0']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('saved_items').update({ archived_at: t.archive === '1' ? new Date().toISOString() : null }).eq('id', t.id).eq('athlete_id', athlete);
  refresh(t.id);
}

/** Registrar una interacción o una nota privada. */
export async function logInteraction(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const parsed = z.object({
    id: uuid,
    kind: z.enum(['interaction', 'note']),
    channel: z.enum(['email', 'call', 'video', 'meeting', 'visit', 'message', 'other']).optional(),
    title: z.string().trim().min(2).max(200),
    body: z.string().trim().max(2000).optional(),
    occurred_on: optDate,
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: { title: 'Escribe un resumen (2-200 caracteres)' }, error: 'Revisa los campos.' };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('pipeline_events').insert({
    athlete_id: athlete, process_id: d.id, kind: d.kind, source: 'user', channel: d.kind === 'interaction' ? d.channel ?? 'other' : null,
    title: d.title, body: d.body || null, occurred_at: d.occurred_on ? new Date(`${d.occurred_on}T12:00:00`).toISOString() : new Date().toISOString(),
  });
  if (error) return { error: 'No se ha podido guardar.' };
  if (d.kind === 'interaction') await logEvent('interaction_logged', { channel: d.channel ?? 'other' });
  refresh(d.id);
  return { ok: true, message: d.kind === 'note' ? 'Nota guardada' : 'Interacción registrada' };
}

export async function deleteEvent(formData: FormData) {
  await editableAthlete(formData);
  const t = z.object({ event: z.coerce.number().int().positive(), id: uuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('pipeline_events').delete().eq('id', t.event);
  refresh(t.id);
}

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const parsed = z.object({ id: z.union([uuid, z.literal('')]).optional(), title: z.string().trim().min(2).max(160), due_date: optDate }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: { title: 'Escribe la tarea (2-160 caracteres)' }, error: 'Revisa la tarea.' };
  const supabase = await createClient();
  const { error } = await supabase.from('pipeline_tasks').insert({ athlete_id: athlete, process_id: parsed.data.id || null, title: parsed.data.title, due_date: parsed.data.due_date, created_by: null });
  if (error) return { error: 'No se ha podido crear la tarea.' };
  refresh(parsed.data.id || undefined);
  return { ok: true, message: 'Tarea añadida' };
}

export async function toggleTask(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ task: uuid, id: z.union([uuid, z.literal('')]).optional(), done: z.enum(['1', '0']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { data } = await supabase.from('pipeline_tasks').update({ done_at: t.done === '1' ? new Date().toISOString() : null }).eq('id', t.task).eq('athlete_id', athlete).select('title, process_id').maybeSingle();
  if (t.done === '1' && data?.process_id) {
    await supabase.from('pipeline_events').insert({ athlete_id: athlete, process_id: data.process_id, kind: 'task_done', source: 'user', title: `Tarea hecha: ${data.title}`.slice(0, 200) });
    await logEvent('task_completed', { task: 'pipeline', priority: 'personal' });
  }
  refresh(t.id || undefined);
}

export async function deleteTask(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ task: uuid, id: z.union([uuid, z.literal('')]).optional() }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('pipeline_tasks').delete().eq('id', t.task).eq('athlete_id', athlete);
  refresh(t.id || undefined);
}

export async function addContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const parsed = z.object({
    id: uuid, name: z.string().trim().min(2).max(120), role: z.string().trim().max(80).optional(),
    email: z.union([z.literal(''), z.string().trim().email().max(200)]).optional(), phone: z.union([z.literal(''), z.string().trim().regex(/^[0-9+() .-]{6,25}$/)]).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Revisa nombre, email o teléfono.' };
  const d = parsed.data;
  const supabase = await createClient();
  const { count } = await supabase.from('pipeline_contacts').select('id', { count: 'exact', head: true }).eq('process_id', d.id);
  if ((count ?? 0) >= 20) return { error: 'Máximo 20 contactos por proceso.' };
  const { error } = await supabase.from('pipeline_contacts').insert({ athlete_id: athlete, process_id: d.id, name: d.name, role: d.role || null, email: d.email || null, phone: d.phone || null });
  if (error) return { error: 'No se ha podido guardar el contacto.' };
  refresh(d.id);
  return { ok: true, message: 'Contacto guardado' };
}

export async function deleteContact(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ contact: uuid, id: uuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('pipeline_contacts').delete().eq('id', t.contact).eq('athlete_id', athlete);
  refresh(t.id);
}

const DOC_KINDS = ['passport', 'transcript', 'translation', 'graduation_proof', 'english_test', 'sat_act', 'highlight_video', 'i20', 'sevis_receipt', 'ds160', 'financial', 'medical', 'other'] as const;

/** Checklist documental: qué pide este proceso, qué documento de tu bóveda lo cubre y cuándo lo enviaste. */
export async function setProcessDocument(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({
    id: uuid, kind: z.enum(DOC_KINDS), op: z.enum(['add', 'remove', 'link', 'sent', 'unsent']),
    document_id: z.union([uuid, z.literal('')]).optional(),
  }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  if (t.op === 'remove') await supabase.from('process_documents').delete().eq('process_id', t.id).eq('kind', t.kind);
  else if (t.op === 'add') await supabase.from('process_documents').upsert({ process_id: t.id, athlete_id: athlete, kind: t.kind });
  else if (t.op === 'link') await supabase.from('process_documents').update({ document_id: t.document_id || null }).eq('process_id', t.id).eq('kind', t.kind);
  else await supabase.from('process_documents').update({ sent_at: t.op === 'sent' ? new Date().toISOString().slice(0, 10) : null }).eq('process_id', t.id).eq('kind', t.kind);
  refresh(t.id);
}

/** Registrar una oferta dentro del proceso (siempre como "registrada por el atleta"). */
export async function addProcessOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  const athlete = await editableAthlete(formData);
  const num = z.union([z.literal(''), z.coerce.number().int().min(0).max(200000)]).optional().transform((v) => (v === '' || v == null ? null : v));
  const parsed = z.object({
    id: uuid, university_name: z.string().trim().min(2).max(200), annual_cost_usd: num, aid_amount_usd: num,
    renewable: z.enum(['yes', 'no', 'unknown']), in_writing: z.string().optional(), deadline: optDate,
    scholarship_type: z.enum(['athletic', 'academic', 'mixed', 'unknown']),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Revisa los datos de la oferta.' };
  const d = parsed.data;
  if (d.aid_amount_usd != null && d.annual_cost_usd != null && d.aid_amount_usd > d.annual_cost_usd) return { fieldErrors: { aid_amount_usd: 'La ayuda no puede superar el coste' }, error: 'Revisa los importes.' };
  const supabase = await createClient();
  const { data: proc } = await supabase.from('saved_items').select('target_kind, target_id').eq('id', d.id).eq('athlete_id', athlete).maybeSingle();
  if (!proc) return { error: 'Proceso no encontrado.' };
  const { error } = await supabase.from('athlete_offers').insert({
    athlete_id: athlete, process_id: d.id, university_name: d.university_name,
    institution_id: proc.target_kind === 'institution' ? proc.target_id : null,
    annual_cost_usd: d.annual_cost_usd, aid_amount_usd: d.aid_amount_usd, renewable: d.renewable,
    in_writing: d.in_writing === 'on', deadline: d.deadline, scholarship_type: d.scholarship_type,
  });
  if (error) return { error: error.message.includes('offers_limit') ? 'Has llegado al máximo de 20 ofertas.' : 'No se ha podido guardar la oferta.' };
  await logEvent('offer_recorded', { in_writing: d.in_writing === 'on' });
  refresh(d.id);
  return { ok: true, message: 'Oferta registrada' };
}

export async function setOfferStatus(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ offer: uuid, id: uuid, status: z.enum(['pending', 'accepted', 'declined', 'expired']) }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  await supabase.from('athlete_offers').update({ status: t.status }).eq('id', t.offer).eq('athlete_id', athlete);
  if (t.status !== 'pending') {
    await supabase.from('pipeline_events').insert({ athlete_id: athlete, process_id: t.id, kind: 'decision', source: 'user', title: t.status === 'accepted' ? 'Oferta aceptada' : t.status === 'declined' ? 'Oferta rechazada' : 'Oferta caducada' });
  }
  refresh(t.id);
}

/** Añadir al pipeline una universidad u oportunidad (desde fichas). */
export async function addToPipeline(formData: FormData) {
  const athlete = await editableAthlete(formData);
  const t = z.object({ kind: z.enum(['institution', 'opportunity']), target: uuid }).parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.from('saved_items').upsert({ athlete_id: athlete, target_kind: t.kind, target_id: t.target }, { onConflict: 'athlete_id,target_kind,target_id', ignoreDuplicates: true });
  if (!error) await stampMatchAtSave(athlete, t.kind, t.target);
  refresh();
}
