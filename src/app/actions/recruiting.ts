'use server';

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/locale';
import { cookies } from 'next/headers';
import { must } from '@/lib/supabase/must';
import { revalidatePath } from 'next/cache';
import { captchaToken } from '@/lib/captcha';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/session';
import { siteUrl } from '@/lib/env';
import { checkAge } from '@/lib/domain/age';
import { isEduEmail } from '@/lib/domain/recruiting';
import type { FormState } from './auth';
import { logEvent } from '@/lib/events';

/*
 * Oleada 1 · Enlace privado de reclutamiento.
 * Las reglas de quién puede crear o revocar viven en la BD (RLS + guard_recruiting_link):
 * adulto para sí mismo; madre, padre o tutor para un menor. Aquí solo validamos y damos mensajes claros.
 */

const DB_ERRORS: Record<string, string> = {
  guardian_required: 'Como eres menor de edad, tu madre, padre o tutor crea los enlaces desde su cuenta.',
  too_many_active_links: 'Tienes 50 enlaces activos. Revoca alguno antes de crear otro.',
};
const friendly = (m: string) => Object.entries(DB_ERRORS).find(([k]) => m.includes(k))?.[1]
  ?? (m.includes('row-level security') ? 'No tienes permiso para crear enlaces de este atleta.' : 'No se ha podido crear el enlace.');

export async function createRecruitingLink(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession(['athlete', 'parent']);
  const parsed = z
    .object({
      athlete_id: z.string().uuid(),
      label: z.string().trim().min(1, 'Ponle un nombre (p. ej., "Coach Smith – Gonzaga")').max(120),
      days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  const supabase = await createClient();
  const { error } = await supabase.from('recruiting_links').insert({
    athlete_id: parsed.data.athlete_id,
    label: parsed.data.label,
    expires_at: new Date(Date.now() + parsed.data.days * 86_400_000).toISOString(),
  });
  if (error) return { error: friendly(error.message) };
  await logEvent('passport_shared', { channel: 'recruiting_link' });
  revalidatePath('/app/share');
  return { ok: true, message: 'Enlace creado. Ya puedes enviarlo.' };
}

export async function revokeRecruitingLink(formData: FormData) {
  await requireSession(['athlete', 'parent']);
  const id = z.string().uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  must(await supabase.from('recruiting_links').update({ revoked_at: new Date().toISOString() }).eq('id', id.data).is('revoked_at', null), 'recruiting_links.update');
  revalidatePath('/app/share');
}

/**
 * Acceso de coach sin contraseña: enlace mágico al correo .edu. Al entrar pasa por el onboarding
 * de coach, donde la verificación automática por dominio .edu ya existe.
 */
export async function requestCoachAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, 'Enter your name').max(120),
      email: z.string().trim().toLowerCase().email('Enter a valid email'),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth'),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isEduEmail(parsed.data.email)) {
    return { error: 'Free fast access is for college staff with a .edu email. Other coaches can create an account and we verify them manually.' };
  }
  const age = checkAge(parsed.data.dob);
  if (!age.ok || age.isMinor) return { error: 'Coach accounts are for adults only.' };

  const supabase = await createClient();
  const next = encodeURIComponent('/onboarding?role=coach');
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      captchaToken: captchaToken(formData),
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${next}`,
      data: { display_name: parsed.data.name, date_of_birth: parsed.data.dob, signup_role: 'coach' },
    },
  });
  if (error) {
    return { error: error.status === 429 ? 'Too many requests. Please wait a minute and try again.' : 'We could not send the link. Please try again.' };
  }
  // Viene de la ficha en inglés: su sesión empieza en inglés (puede cambiarlo con el selector).
  (await cookies()).set(LOCALE_COOKIE, 'en', { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return { ok: true, message: `Check ${parsed.data.email}: we sent you a sign-in link (no password needed).` };
}
