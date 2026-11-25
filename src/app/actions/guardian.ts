'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/events';
import { GUARDIAN_STATEMENT_VERSION } from '@/lib/domain/guardian-verification';

const uuid = z.string().uuid();

/** Fase 5: el tutor firma la declaración (versión vigente). La base de datos comprueba vínculo, menor y parentesco. */
export async function attestGuardian(formData: FormData) {
  await requireSession(['parent']);
  const p = z.object({ link: uuid, athlete: uuid, accept: z.literal('on') }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect(`/app/family?verificacion=falta_aceptar`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('guardian_attest', { p_link: p.data.link, p_version: GUARDIAN_STATEMENT_VERSION });
  if (error) redirect(`/app/family?child=${p.data.athlete}&verificacion=error`);
  await logEvent('guardian_attested');
  revalidatePath('/app/family');
  redirect(`/app/family?child=${p.data.athlete}&verificacion=enviada`);
}

/** Administración: aprobar o rechazar la verificación de un tutor, siempre con motivo (queda auditado). */
export async function reviewGuardian(formData: FormData) {
  await requireSession(['admin']);
  const p = z.object({ link: uuid, decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(10).max(300) }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect('/app/admin/safety?tutor=motivo');
  const supabase = await createClient();
  const { error } = await supabase.rpc('guardian_review', { p_link: p.data.link, p_approve: p.data.decision === 'approve', p_reason: p.data.reason });
  revalidatePath('/app/admin/safety');
  redirect(`/app/admin/safety?tutor=${error ? 'error' : p.data.decision === 'approve' ? 'aprobado' : 'rechazado'}`);
}
