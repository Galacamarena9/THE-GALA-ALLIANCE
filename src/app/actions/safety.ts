'use server';

import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import type { FormState } from './auth';

/**
 * Prompt 14 · Trust & Safety. Cada acción pasa por una función de la base de datos que exige el rol interno
 * adecuado (Trust & Safety), un motivo, y deja auditoría. La interfaz no decide nada por su cuenta.
 */
const uuid = z.string().uuid();
const opt = z.string().uuid().optional().or(z.literal('')).transform((v) => v || null);
const ERR: Record<string, string> = {
  admin_only: 'Necesitas el rol de Trust & Safety.',
  moderation_restriction_scoped: 'Una restricción necesita al menos un ámbito.',
  cannot_moderate_self: 'No puedes sancionarte a ti mismo.',
  second_reviewer_required: 'La apelación la resuelve otra persona distinta de quien sancionó.',
  nothing_to_appeal: 'Esa medida ya no está activa.',
  invalid_duration: 'Duración no válida.',
};
const friendly = (m: string) => Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? (m.includes('check constraint') ? 'Revisa el motivo (mínimo 10 caracteres).' : 'No se ha podido completar.');

export async function openSafetyCase(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['admin']);
  const p = z.object({
    title: z.string().trim().min(3).max(200),
    category: z.enum(['minor', 'fraud', 'payment', 'organization', 'messaging', 'impersonation', 'privacy', 'other']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    subject_user: opt, subject_org: opt, report_id: opt,
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: 'Revisa el título y la categoría.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('safety_case_open', {
    p_title: p.data.title, p_category: p.data.category, p_priority: p.data.priority,
    p_subject_user: p.data.subject_user, p_subject_org: p.data.subject_org, p_reports: p.data.report_id ? [p.data.report_id] : [],
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/app/admin/safety');
  return { ok: true, message: 'Caso abierto.' };
}

export async function moderate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['admin']);
  const p = z.object({
    action: z.enum(['no_action', 'warning', 'content_removed', 'opportunity_paused', 'user_restricted', 'organization_restricted', 'suspended', 'verification_revoked', 'escalate']),
    reason: z.string().trim().min(10, 'Explica el motivo (mínimo 10 caracteres).').max(2000),
    subject_user: opt, subject_org: opt, case_id: opt, report_id: opt,
    days: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().min(1).max(3650).nullable()),
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa los campos.' };
  const scopes = formData.getAll('scopes').map(String).filter((s) => /^[a-z]+$/.test(s));
  const supabase = await createClient();
  const { error } = await supabase.rpc('moderation_act', {
    p_action: p.data.action, p_reason: p.data.reason, p_subject_user: p.data.subject_user, p_subject_org: p.data.subject_org,
    p_scopes: scopes, p_days: p.data.days, p_case: p.data.case_id, p_report: p.data.report_id,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/app/admin/safety');
  return { ok: true, message: 'Medida aplicada y notificada.' };
}

export async function revertModeration(formData: FormData) {
  await requireSession(['admin']);
  const p = z.object({ id: uuid, reason: z.string().trim().min(3).max(2000) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const supabase = await createClient();
  must(await supabase.rpc('moderation_revert', { p_action: p.data.id, p_reason: p.data.reason }), 'rpc.moderation_revert');
  revalidatePath('/app/admin/safety');
}

export async function decideAppeal(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['admin']);
  const p = z.object({ id: uuid, decision: z.enum(['overturn', 'uphold']), reason: z.string().trim().min(10, 'Explica la decisión.').max(2000) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa los campos.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('moderation_appeal_decide', { p_appeal: p.data.id, p_overturn: p.data.decision === 'overturn', p_reason: p.data.reason });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/app/admin/safety');
  return { ok: true, message: 'Apelación resuelta.' };
}

/** La persona afectada (o quien dirige la organización afectada) apela una medida. */
export async function appealModeration(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const p = z.object({ id: uuid, body: z.string().trim().min(20, 'Cuéntanos tu versión (mínimo 20 caracteres).').max(4000) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Revisa el texto.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('moderation_appeal', { p_action: p.data.id, p_body: p.data.body });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/app/trust');
  return { ok: true, message: 'Apelación enviada. La revisará una persona distinta de quien tomó la medida.' };
}
