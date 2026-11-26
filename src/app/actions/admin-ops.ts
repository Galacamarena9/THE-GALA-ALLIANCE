'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { logEvent } from '@/lib/events';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { requireAdmin } from '@/lib/admin-guard';
import type { FormState } from './auth';

/** 16 · Operaciones de Gala. Cada acción la valida la base de datos (rol interno, motivo, doble aprobación). */
const fail = (m: string) => ({ error: m.includes('admin_only') ? 'No tienes el rol interno necesario.' : m.includes('reason_required') ? 'Explica el motivo (mínimo 10 caracteres).' : m.includes('second_approver') ? 'La aprueba otra persona distinta de quien la pidió.' : 'No se ha podido completar.' });

export async function setFlag(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin('/app/admin/ops');
  const p = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{2,60}$/), enabled: z.enum(['yes', 'no']), reason: z.string().trim().max(500) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Solicitud no válida.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('flag_set', { p_key: p.data.key, p_enabled: p.data.enabled === 'yes', p_reason: p.data.reason });
  if (error) return fail(error.message);
  revalidatePath('/app/admin/ops');
  return { ok: true, message: p.data.enabled === 'yes' ? 'Funcionalidad activada.' : 'Funcionalidad desactivada para todos.' };
}

const opsBack = (aviso: string, view?: 'support'): never =>
  redirect(`/app/admin/ops?${view ? `view=${view}&` : ''}aviso=${encodeURIComponent(aviso)}`);

export async function updateSupportCase(formData: FormData) {
  await requireAdmin('/app/admin/ops?view=support');
  const p = z.object({ id: z.string().uuid(), status: z.enum(['open', 'waiting_user', 'in_progress', 'resolved', 'closed']), note: z.string().trim().max(4000).optional(), public: z.literal('on').optional() })
    .safeParse(Object.fromEntries(formData));
  if (!p.success) opsBack('Solicitud no válida.', 'support');
  const supabase = await createClient();
  const { error } = await supabase.rpc('support_case_update', { p_case: p.data!.id, p_status: p.data!.status, p_note: p.data!.note || null, p_public: p.data!.public === 'on' });
  if (error) opsBack(fail(error.message).error, 'support');
  revalidatePath('/app/admin/ops');
  opsBack('Caso actualizado.', 'support');
}

/**
 * Doble aprobación. Para aprobar el borrado de una organización hay que escribir su nombre exacto: el segundo
 * aprobador ve qué organización se borra (nombre, tipo, miembros, oportunidades) y no firma a ciegas.
 */
export async function decideApproval(formData: FormData) {
  await requireAdmin('/app/admin/ops');
  const p = z.object({ id: z.string().uuid(), decision: z.enum(['approve', 'reject']), confirm_name: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect('/app/admin/ops?aprobacion=error');
  const supabase = await createClient();
  if (p.data!.decision === 'approve') {
    const { data: a } = await supabase.from('admin_approvals').select('action, payload').eq('id', p.data!.id).maybeSingle();
    if (a?.action === 'organization_delete') {
      const orgId = (a.payload as { organization_id?: string } | null)?.organization_id;
      const { data: org } = orgId ? await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle() : { data: null };
      if (!org || (p.data!.confirm_name ?? '').toLowerCase() !== String(org.name).trim().toLowerCase()) redirect('/app/admin/ops?aprobacion=confirmar_nombre');
    }
  }
  const { error } = await supabase.rpc('admin_approve', { p_approval: p.data!.id, p_approve: p.data!.decision === 'approve' });
  redirect(`/app/admin/ops?aprobacion=${error ? (error.message.includes('second_approver') ? 'misma_persona' : 'error') : 'ok'}`);
}

export async function resolveConflict(formData: FormData) {
  await requireAdmin('/app/admin/ops');
  const p = z.object({ id: z.string().uuid(), resolution: z.string().trim().min(10).max(1000), activate: z.string().uuid().optional().or(z.literal('')) }).safeParse(Object.fromEntries(formData));
  if (!p.success) opsBack('Explica la resolución (mínimo 10 caracteres).');
  const supabase = await createClient();
  const { error } = await supabase.rpc('representation_conflict_resolve', { p_conflict: p.data!.id, p_resolution: p.data!.resolution, p_activate: p.data!.activate || null });
  if (error) opsBack(fail(error.message).error);
  revalidatePath('/app/admin/ops');
  opsBack('Conflicto resuelto.');
}

/** Lado del usuario: abrir un caso de soporte. */
export async function openSupportCase(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const p = z.object({
    subject: z.string().trim().min(3, 'Pon un asunto').max(200),
    body: z.string().trim().min(10, 'Cuéntanos qué pasa (mínimo 10 caracteres)').max(4000),
    category: z.enum(['account', 'verification', 'billing', 'safety', 'bug', 'data', 'other']),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa los campos.' };
  const supabase = await createClient();
  const { error } = await supabase.from('support_cases').insert({ ...p.data, requester_id: session.userId });
  if (error) return { error: 'No se ha podido enviar.' };
  revalidatePath('/app/support');
  await logEvent('support_case_opened', { category: p.data.category });
  return { ok: true, message: 'Recibido. Te responderemos aquí y te avisaremos.' };
}
