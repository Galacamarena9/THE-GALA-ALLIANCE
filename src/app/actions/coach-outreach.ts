'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { siteUrl } from '@/lib/env';
import { fillLink, mailtoHref } from '@/lib/domain/coach-outreach';

export interface PrepareState {
  error?: string;
  prepared?: { id: string; to: string; subject: string; body: string; link: string; mailto: string };
}

const ERRORS: [string, string][] = [
  ['contact_permission_required', 'El atleta no ha dado permiso a tu agencia para contactar con universidades en su nombre. Pídeselo desde su representación.'],
  ['representation_required', 'La representación con este atleta ya no está activa.'],
  ['not_approved_to_contact', 'Pasa primero el proceso a «Aprobado para contactar».'],
  ['email_invalid', 'Escribe un email válido del coach (o elige un contacto que lo tenga).'],
  ['contact_not_in_agency', 'Ese contacto no es de tu agencia.'],
  ['daily_limit', 'Has preparado 100 emails en las últimas 24 horas. Vuelve a intentarlo más tarde.'],
  ['too_many_active_links', 'El atleta tiene 50 enlaces activos. Pídele que revoque alguno antiguo.'],
  ['not_allowed', 'No tienes permiso para escribir en este proceso.'],
];
const explain = (msg: string) => ERRORS.find(([k]) => msg.includes(k))?.[1] ?? 'No se ha podido preparar el email.';

const prepareSchema = z.object({
  case_id: z.string().uuid(),
  contact_id: z.string().uuid().or(z.literal('')).optional(),
  to_email: z.string().max(254).optional(),
  subject: z.string().trim().min(3, 'Escribe un asunto.').max(200),
  body: z.string().min(10, 'El mensaje es demasiado corto.').max(4800),
});

/** Crea el enlace privado al Passport y deja el email listo para abrir en el correo de la agencia. */
export async function prepareOutreach(_prev: PrepareState, formData: FormData): Promise<PrepareState> {
  await requireSession(['agent']);
  const parsed = prepareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa el formulario.' };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('case_outreach_create', {
    p_case: d.case_id, p_contact: d.contact_id || null, p_email: d.to_email ?? '', p_subject: d.subject, p_body: d.body,
  });
  const row = (data as { id: string; token: string }[] | null)?.[0];
  if (error || !row) return { error: explain(error?.message ?? '') };
  const { data: saved } = await supabase.from('case_outreach').select('to_email').eq('id', row.id).maybeSingle();
  const to = saved?.to_email ?? d.to_email ?? '';
  const link = `${siteUrl()}/r/${row.token}`;
  const body = fillLink(d.body, link);
  revalidatePath(`/app/pipeline/${d.case_id}`);
  return { prepared: { id: row.id, to, subject: d.subject, body, link, mailto: mailtoHref(to, d.subject, body) } };
}

const markSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  status: z.enum(['sent', 'replied', 'no_reply', 'bounced']),
  note: z.string().max(1000).optional(),
});

/** Registra «enviado», «ha respondido», «sin respuesta» o «rebotado». */
export async function markOutreach(formData: FormData) {
  await requireSession(['agent']);
  const parsed = markSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { id, case_id, status, note } = parsed.data;
  const { error } = await (await createClient()).rpc('case_outreach_mark', { p_id: id, p_status: status, p_note: note || undefined });
  if (!error) {
    if (status === 'sent') await logEvent('coach_outreach_sent', { case: case_id });
    if (status === 'replied') await logEvent('coach_reply_logged', { case: case_id });
  }
  revalidatePath(`/app/pipeline/${case_id}`);
  revalidatePath('/app/pipeline');
}
