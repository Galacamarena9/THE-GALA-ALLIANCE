'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { orgNameKey } from '@/lib/domain/org-name';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/env';
import { logEvent } from '@/lib/events';
import { sendVerificationEmail, type SendResult } from '@/lib/verification/email';

export type OrgHit = { kind: 'organization' | 'institution'; id: string; name: string; place: string; verified: boolean };

/** Paso 2: buscar la institución. Primero organizaciones existentes; después universidades importadas sin organización. */
export async function searchInstitutions(q: string): Promise<OrgHit[]> {
  await requireSession();
  const term = q.replace(/[%_,()\\]/g, '').trim().slice(0, 80);
  const key = orgNameKey(term);
  if (term.length < 2) return [];
  const supabase = await createClient();
  const [{ data: orgs }, { data: insts }] = await Promise.all([
    supabase.from('organizations').select('id, name, city, state, country, verification_status, institution_id')
      .in('type', ['university', 'college', 'club', 'academy'])
      // Por nombre y por clave canónica: «ValenciaBasket» o «Valencia Basket Club» encuentran «Valencia Basket».
      .or(key ? `name.ilike.%${term}%,name_key.like.%${key}%` : `name.ilike.%${term}%`).limit(8),
    supabase.from('institutions').select('id, name, city, state').ilike('name', `%${term}%`).limit(8),
  ]);
  const linked = new Set((orgs ?? []).map((o) => o.institution_id).filter(Boolean));
  return [
    ...(orgs ?? []).map((o) => ({ kind: 'organization' as const, id: o.id, name: o.name, place: [o.city, o.state, o.country].filter(Boolean).join(', '), verified: o.verification_status === 'verified' })),
    ...(insts ?? []).filter((i) => !linked.has(i.id)).map((i) => ({ kind: 'institution' as const, id: i.id, name: i.name, place: [i.city, i.state].filter(Boolean).join(', '), verified: false })),
  ];
}

/** Programas de una organización (paso 3). */
export async function listPrograms(org: string) {
  await requireSession();
  if (!z.string().uuid().safeParse(org).success) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('org_programs').select('id, name, sport_id').eq('organization_id', org).is('archived_at', null);
  return data ?? [];
}

const submitSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2, 'Indica tu cargo').max(80),
  kind: z.enum(['organization', 'institution']),
  target: z.string().uuid(),
  program: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  role: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email('Correo no válido').max(254),
});

export type SubmitResult = { ok: boolean; message: string; email?: SendResult };

/**
 * Pasos 1–5 en una sola operación al final (nada se guarda a medias):
 * crea la solicitud de verificación (o la reclamación si la universidad aún no tiene organización)
 * e inicia la verificación del correo institucional. Nunca concede acceso: lo decide un revisor.
 */
export async function submitVerification(input: z.input<typeof submitSchema>): Promise<SubmitResult> {
  const session = await requireSession();
  const p = submitSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Revisa los datos.' };
  const d = p.data;
  const supabase = await createClient();
  if (/@(gmail|hotmail|outlook|yahoo|icloud|live|proton)\./.test(d.email)) {
    return { ok: false, message: 'Usa tu correo institucional (no uno personal). Si no tienes, un revisor puede validarlo de otra forma: escríbenos desde Ayuda.' };
  }

  let org: string | null = null;
  if (d.kind === 'organization') {
    org = d.target;
    const { error } = await supabase.rpc('verification_submit', { p_type: d.program ? 'program_affiliation' : 'organization_affiliation', p_org: org, p_program: d.program, p_declared_role: `${d.role} · ${d.title}`.slice(0, 80) });
    if (error && !error.message.includes('duplicate key')) return { ok: false, message: 'No se ha podido enviar la solicitud. Inténtalo de nuevo.' };
  } else {
    const { error } = await supabase.from('institution_claims').insert({ institution_id: d.target, work_email: d.email, role_title: `${d.role} · ${d.title}`.slice(0, 120), user_id: session.userId });
    if (error && error.code !== '23505') return { ok: false, message: 'No se ha podido enviar la solicitud. Inténtalo de nuevo.' };
  }

  const { data: evId, error: evErr } = await supabase.rpc('email_verification_start', { p_org: org, p_email: d.email });
  await logEvent('verification_requested', { kind: d.kind });
  revalidatePath('/app/verify');
  if (evErr) return { ok: true, message: evErr.message.includes('too_many_attempts') ? 'Solicitud enviada. Has pedido demasiados correos hoy: inténtalo mañana.' : 'Solicitud enviada.', email: 'failed' };
  const sent = await sendVerificationEmail(evId as string, d.email, siteUrl());
  return {
    ok: true, email: sent,
    message: sent === 'sent' ? `Te hemos enviado un enlace a ${d.email}. Ábrelo en este dispositivo con tu sesión iniciada.`
      : sent === 'not_configured' ? 'Solicitud enviada. El envío automático de correos aún no está activo: un revisor de Gala comprobará tu afiliación.'
      : 'Solicitud enviada, pero no hemos podido enviar el correo. Puedes reenviarlo desde tu estado de verificación.',
  };
}

/** Reenviar el enlace (reutiliza la última verificación pendiente; la BD limita intentos). */
export async function resendVerificationEmail(id: string): Promise<SubmitResult> {
  await requireSession();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: 'Datos no válidos.' };
  const supabase = await createClient();
  const { data: ev } = await supabase.from('email_verifications').select('id, email, result').eq('id', id).maybeSingle();
  if (!ev || ev.result !== 'pending') return { ok: false, message: 'Esta verificación ya no está pendiente.' };
  const sent = await sendVerificationEmail(ev.id, ev.email, siteUrl());
  return { ok: sent === 'sent', email: sent, message: sent === 'sent' ? 'Enlace reenviado.' : sent === 'not_configured' ? 'El envío de correos aún no está activo.' : 'No se ha podido enviar. Inténtalo más tarde.' };
}
