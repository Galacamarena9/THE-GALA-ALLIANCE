'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from '@/app/actions/auth';
import { CASE_STAGES, AGENCY_ROLES } from '@/lib/domain/agency-cases';

const ERRORS: Record<string, string> = {
  representation_required: 'Solo puedes abrir procesos con atletas que han aceptado tu representación.',
  duplicate: 'Ya hay un proceso con esa universidad y temporada para este atleta.',
  owner_not_member: 'El responsable tiene que ser miembro de la agencia.',
  assignee_not_member: 'La tarea solo se puede asignar a alguien de la agencia.',
  contact_not_in_agency: 'Ese contacto no es de tu agencia.',
  'row-level security': 'No tienes permiso para hacer esto (¿tu rol es de solo lectura?).',
};
const errorText = (msg?: string) =>
  msg?.includes('duplicate key') ? ERRORS.duplicate
    : Object.entries(ERRORS).find(([k]) => msg?.includes(k))?.[1] ?? 'No se ha podido guardar. Inténtalo de nuevo.';

const stageIds = CASE_STAGES.map((s) => s.id) as [string, ...string[]];
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform((v) => v || null);
const optionalUuid = z.string().uuid().optional().or(z.literal('')).transform((v) => v || null);

const openSchema = z.object({
  agency_id: z.string().uuid(),
  athlete_id: z.string().uuid({ message: 'Elige un atleta.' }),
  institution_name: z.string().trim().min(2, 'Escribe la universidad.').max(200),
  sport_id: optional(40),
  cycle: z.string().regex(/^\d{4}-\d{2}$/, 'Elige la temporada.'),
  stage: z.enum(stageIds).default('research'),
  contact_id: optionalUuid,
  next_action: optional(300),
  next_action_due: optionalDate,
});

export async function openCase(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = openSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.from('recruiting_cases').insert(parsed.data).select('id').single();
  if (error) return { error: errorText(error.message) };
  revalidatePath('/app/pipeline');
  redirect(`/app/pipeline/${data.id}`);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(stageIds),
  owner_id: optionalUuid,
  contact_id: optionalUuid,
  next_action: optional(300),
  next_action_due: optionalDate,
  outcome_reason: optional(500),
});

/** Cambio de fase y próxima acción. El historial se escribe solo (trigger en la base de datos). */
export async function updateCase(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, ...patch } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from('recruiting_cases').update(patch).eq('id', id).select('id');
  if (error) return { error: errorText(error.message) };
  if (!data?.length) return { error: ERRORS['row-level security'] };
  revalidatePath('/app/pipeline');
  revalidatePath(`/app/pipeline/${id}`);
  return { ok: true, message: 'Guardado.' };
}

/** Mover una tarjeta del tablero a otra fase. */
export async function moveCase(formData: FormData) {
  await requireSession(['agent']);
  const parsed = z.object({ id: z.string().uuid(), stage: z.enum(stageIds) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('recruiting_cases').update({ stage: parsed.data.stage }).eq('id', parsed.data.id);
  revalidatePath('/app/pipeline');
  revalidatePath(`/app/pipeline/${parsed.data.id}`);
}

export async function toggleShare(formData: FormData) {
  await requireSession(['agent']);
  const parsed = z.object({ id: z.string().uuid(), shared: z.enum(['true', 'false']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('recruiting_cases').update({ shared_with_athlete: parsed.data.shared === 'true' }).eq('id', parsed.data.id);
  revalidatePath(`/app/pipeline/${parsed.data.id}`);
}

const activitySchema = z.object({
  case_id: z.string().uuid(),
  kind: z.enum(['email', 'call', 'meeting', 'message', 'note']),
  body: z.string().trim().min(2, 'Escribe qué pasó.').max(5000),
  occurred_on: optionalDate,
});

/** Registrar a mano una interacción (no se envía nada desde la plataforma). */
export async function logActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(['agent']);
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { occurred_on, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('recruiting_case_activities')
    .insert({ ...rest, actor_id: session.userId, ...(occurred_on ? { occurred_on } : {}) });
  if (error) return { error: errorText(error.message) };
  revalidatePath(`/app/pipeline/${parsed.data.case_id}`);
  return { ok: true, message: 'Registrado.' };
}

const taskSchema = z.object({
  case_id: z.string().uuid(),
  title: z.string().trim().min(2, 'Escribe la tarea.').max(200),
  assignee_id: optionalUuid,
  due_date: optionalDate,
});

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('recruiting_case_tasks').insert(parsed.data);
  if (error) return { error: errorText(error.message) };
  revalidatePath(`/app/pipeline/${parsed.data.case_id}`);
  revalidatePath('/app/pipeline');
  return { ok: true, message: 'Tarea creada.' };
}

export async function toggleTask(formData: FormData) {
  await requireSession(['agent']);
  const parsed = z.object({ id: z.string().uuid(), case_id: z.string().uuid(), done: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('recruiting_case_tasks').update({ done: parsed.data.done === 'true' }).eq('id', parsed.data.id);
  revalidatePath(`/app/pipeline/${parsed.data.case_id}`);
}

const contactSchema = z.object({
  agency_id: z.string().uuid(),
  institution_name: z.string().trim().min(2, 'Escribe la universidad.').max(200),
  sport_id: optional(40),
  name: z.string().trim().min(2, 'Escribe el nombre del contacto.').max(120),
  role_title: optional(120),
  email: z.string().trim().email('Email no válido.').optional().or(z.literal('')).transform((v) => v || null),
  phone: optional(40),
  notes: optional(2000),
});

export async function addContact(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from('agency_contacts').insert(parsed.data);
  if (error) return { error: errorText(error.message) };
  revalidatePath('/app/contacts');
  return { ok: true, message: 'Contacto guardado.' };
}

export async function deleteContact(formData: FormData) {
  await requireSession(['agent']);
  const parsed = z.object({ id: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('agency_contacts').delete().eq('id', parsed.data.id);
  revalidatePath('/app/contacts');
}

const roleIds = AGENCY_ROLES.map((r) => r.id) as [string, ...string[]];

/** Solo los administradores de la organización pueden cambiar roles (lo garantiza la RLS existente). */
export async function setAgencyRole(formData: FormData) {
  await requireSession(['agent']);
  const parsed = z.object({ organization_id: z.string().uuid(), user_id: z.string().uuid(), agency_role: z.enum(roleIds) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from('organization_members').update({ agency_role: parsed.data.agency_role })
    .eq('organization_id', parsed.data.organization_id).eq('user_id', parsed.data.user_id);
  revalidatePath('/app/pipeline/team');
}

/** Importa contactos desde CSV (Excel → Guardar como CSV). Omite los que ya existen (misma universidad y nombre). */
export async function importContacts(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['agent']);
  const agency = z.string().uuid().safeParse(formData.get('agency_id'));
  const file = formData.get('file');
  if (!agency.success) return { error: 'Elige la agencia.' };
  if (!(file instanceof File) || !file.size) return { error: 'Elige un archivo CSV.' };
  if (file.size > 900_000) return { error: 'El archivo es demasiado grande (máximo 900 KB).' };
  const { parseContactsCsv } = await import('@/lib/domain/csv-import');
  const parsed = parseContactsCsv(await file.text());
  if (!parsed.rows.length) return { error: parsed.fatal ?? parsed.errors[0]?.message ?? 'No hay filas válidas.' };

  const supabase = await createClient();
  const { data: existing } = await supabase.from('agency_contacts').select('institution_name, name').eq('agency_id', agency.data);
  const key = (i: string, n: string) => `${i.trim().toLowerCase()}|${n.trim().toLowerCase()}`;
  const seen = new Set((existing ?? []).map((c) => key(c.institution_name, c.name)));
  const fresh = parsed.rows.filter((r) => { const k = key(r.institution_name, r.name); if (seen.has(k)) return false; seen.add(k); return true; });
  const skipped = parsed.rows.length - fresh.length;
  if (fresh.length) {
    const { error } = await supabase.from('agency_contacts').insert(fresh.map((r) => ({ ...r, agency_id: agency.data })));
    if (error) return { error: errorText(error.message) };
  }
  revalidatePath('/app/contacts');
  const parts = [`${fresh.length} contacto${fresh.length === 1 ? '' : 's'} importado${fresh.length === 1 ? '' : 's'}`];
  if (skipped) parts.push(`${skipped} ya existían`);
  if (parsed.errors.length) parts.push(`${parsed.errors.length} fila${parsed.errors.length === 1 ? '' : 's'} con errores (${parsed.errors.slice(0, 3).map((e) => `línea ${e.line}: ${e.message}`).join(' · ')}${parsed.errors.length > 3 ? '…' : ''})`);
  if (parsed.fatal) parts.push(parsed.fatal);
  return { ok: true, message: parts.join('. ') + '.' };
}
