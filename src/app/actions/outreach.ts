'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { siteUrl } from '@/lib/env';
import { OUTREACH_SEED } from '@/content/outreach-seed';
import { CHANNELS, MAX_INVITES_PER_BATCH, OUTREACH_SEGMENTS, RESPONSE_ANSWERS, canAutoInvite, invitationEmail, type OutreachSegment } from '@/lib/domain/outreach';
import { outreachNotifyEmail, outreachReplyTo, outreachSenderName, sendEmail } from '@/lib/outreach/send';

const PATH = '/app/admin/difusion';

async function requireAdmin() {
  const session = await requireSession(['admin']);
  if (!session.roles.includes('admin')) throw new Error('admin_only');
  return session;
}

const back = (aviso: string): never => redirect(`${PATH}?aviso=${encodeURIComponent(aviso)}`);

const contactSchema = z.object({
  segment: z.enum(OUTREACH_SEGMENTS),
  organization_name: z.string().trim().min(2).max(160),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().or(z.literal('')),
  website: z.string().trim().url().regex(/^https?:\/\//).optional().or(z.literal('')),
  channel: z.enum(CHANNELS),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  role_title: z.string().trim().max(120).optional().or(z.literal('')),
  source_url: z.string().trim().url().regex(/^https?:\/\//),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  is_organization: z.literal('on'),
});

/** Añade una organización. Exige la página pública de donde sale el contacto y confirmar que es una organización. */
export async function addOutreachContact(formData: FormData) {
  const session = await requireAdmin();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back('Revisa los campos: hace falta nombre, la página pública de origen y marcar que es una organización.');
  const d = parsed.data!;
  if (d.channel === 'email' && !d.email) back('Con el canal «Correo» hace falta un correo de contacto.');
  const supabase = await createClient();
  const { data, error } = await supabase.from('outreach_contacts').insert({
    segment: d.segment, organization_name: d.organization_name, country: d.country || null, website: d.website || null,
    channel: d.channel, email: d.email ? d.email.toLowerCase() : null, role_title: d.role_title || null,
    source_url: d.source_url, notes: d.notes || null,
  }).select('id').single();
  if (error) back(/suppressed/.test(error.message) ? 'Ese correo pidió no recibir más mensajes: no se puede volver a añadir.'
    : /duplicate|unique/.test(error.message) ? 'Esa organización o ese correo ya están en la lista.' : 'No se ha podido guardar.');
  await supabase.from('outreach_events').insert({ contact_id: data!.id, kind: 'created', actor_id: session.userId });
  revalidatePath(PATH);
  back(`Añadida: ${d.organization_name}.`);
}

/** Carga la lista inicial del informe. Idempotente: las organizaciones que ya estén no se duplican. */
export async function importOutreachSeed() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: existing } = await supabase.from('outreach_contacts').select('organization_name, segment');
  const have = new Set((existing ?? []).map((r) => `${String(r.segment)}|${String(r.organization_name).toLowerCase()}`));
  const rows = OUTREACH_SEED.filter((s) => !have.has(`${s.segment}|${s.organizationName.toLowerCase()}`)).map((s) => ({
    segment: s.segment, organization_name: s.organizationName, country: s.country, channel: s.channel, email: s.email,
    source_url: s.sourceUrl, notes: s.notes,
  }));
  let added = 0;
  for (const r of rows) {
    const { error } = await supabase.from('outreach_contacts').insert(r);
    if (!error) added += 1;
  }
  revalidatePath(PATH);
  back(added ? `Lista inicial cargada: ${added} organizaciones nuevas.` : 'La lista inicial ya estaba cargada.');
}

/**
 * Envía la invitación (una sola, pidiendo permiso) a los contactos elegidos que tengan correo y no hayan sido contactados.
 * Máximo 25 por clic. Si el correo no está configurado, no se marca nada como enviado.
 */
export async function sendOutreachInvites(formData: FormData) {
  await requireAdmin();
  const ids = z.array(z.string().uuid()).max(200).safeParse(formData.getAll('id'));
  if (!ids.success || !ids.data.length) back('Marca al menos una organización.');
  const supabase = await createClient();
  const { data: rows } = await supabase.from('outreach_contacts')
    .select('id, segment, organization_name, channel, email, source_url, status').in('id', ids.data!);
  const ready = (rows ?? []).filter((r) => canAutoInvite({ status: r.status, email: r.email, channel: r.channel })).slice(0, MAX_INVITES_PER_BATCH);
  if (!ready.length) back('Ninguna de las marcadas se puede invitar automáticamente: necesitan correo y no haber sido contactadas.');
  let sent = 0; let failed = 0;
  for (const r of ready) {
    const { data: token, error } = await supabase.rpc('outreach_issue_invite', { p_id: r.id });
    if (error || typeof token !== 'string') { failed += 1; continue; }
    const mail = invitationEmail({
      organizationName: r.organization_name, segment: r.segment as OutreachSegment, sourceUrl: r.source_url,
      respondUrl: `${siteUrl()}/difusion/${token}`, senderName: outreachSenderName(),
    });
    const res = await sendEmail({ to: r.email!, subject: mail.subject, html: mail.html, text: mail.text, replyTo: outreachReplyTo() });
    if (res === 'sent') { sent += 1; continue; }
    await supabase.rpc('outreach_revert_invite', { p_id: r.id });
    if (res === 'not_configured') {
      revalidatePath(PATH);
      back('El envío de correo no está configurado (faltan RESEND_API_KEY y EMAIL_FROM). No se ha enviado nada.');
    }
    failed += 1;
  }
  revalidatePath(PATH);
  const skipped = ids.data!.length - ready.length;
  back([`Invitaciones enviadas: ${sent}.`, failed ? `Fallidas: ${failed} (se pueden reintentar).` : '', skipped ? `Sin enviar: ${skipped} (sin correo, ya contactadas o por encima de ${MAX_INVITES_PER_BATCH}).` : ''].filter(Boolean).join(' '));
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(['contacted', 'accepted', 'declined', 'registered', 'bounced']), detail: z.string().max(500).optional() });

/** Cambios manuales permitidos (contacto por formulario o teléfono, respuesta recibida por otra vía, ya registrada). */
export async function setOutreachStatus(formData: FormData) {
  const session = await requireAdmin();
  const p = statusSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) back('Cambio no válido.');
  const supabase = await createClient();
  const { error } = await supabase.from('outreach_contacts').update({ status: p.data!.status }).eq('id', p.data!.id);
  if (error) back('Ese cambio de estado no está permitido.');
  await supabase.from('outreach_events').insert({ contact_id: p.data!.id, kind: p.data!.status, actor_id: session.userId, detail: p.data!.detail || null });
  revalidatePath(PATH);
  back('Estado actualizado.');
}

export async function deleteOutreachContact(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) back('Contacto no válido.');
  const supabase = await createClient();
  await supabase.from('outreach_contacts').delete().eq('id', id.data!);
  revalidatePath(PATH);
  back('Contacto eliminado.');
}

/**
 * Respuesta pública (sin sesión) desde el enlace del correo. Solo con POST: los antivirus de correo que abren
 * enlaces no pueden aceptar ni dar de baja por su cuenta. Avisa a Gala en la app (lo hace la base de datos) y por correo.
 */
export async function respondOutreach(formData: FormData) {
  const p = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), answer: z.enum(RESPONSE_ANSWERS) }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect('/difusion/invalido');
  const supabase = await createClient();
  const { data: preview } = await supabase.rpc('outreach_preview', { p_token: p.data!.token });
  const org = ((preview as { organization_name: string }[] | null)?.[0])?.organization_name ?? null;
  const { data: result } = await supabase.rpc('outreach_respond', { p_token: p.data!.token, p_answer: p.data!.answer });
  const notify = outreachNotifyEmail();
  if (notify && org && (result === 'accepted' || result === 'declined' || result === 'unsubscribed')) {
    const line = result === 'accepted' ? `${org} quiere probar la plataforma. Escríbeles con el acceso de prueba.`
      : result === 'declined' ? `${org} no está interesada ahora.` : `${org} pidió no recibir más mensajes (baja definitiva).`;
    await sendEmail({ to: notify, subject: `Difusión · ${line}`.slice(0, 140), text: `${line}\n\n${siteUrl()}${PATH}`, html: `<p>${line.replace(/[<>&]/g, '')}</p><p><a href="${siteUrl()}${PATH}">Abrir la lista de difusión</a></p>` });
  }
  redirect(`/difusion/${p.data!.token}?hecho=${encodeURIComponent(String(result ?? 'invalid'))}`);
}
