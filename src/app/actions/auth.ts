'use server';

import { afterSignupPath, safeRedirectPath } from '@/lib/domain/safe-path';
import { logEvent } from '@/lib/events';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkAge } from '@/lib/domain/age';
import { siteUrl } from '@/lib/env';
import { checkNewPassword } from '@/lib/domain/password';
import { captchaToken } from '@/lib/captcha';

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string } | undefined;

const ROLES = ['athlete', 'parent', 'coach', 'agent', 'brand'] as const;

const signupSchema = z.object({
  displayName: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Email no válido'),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(72),
  dateOfBirth: z.string(),
  role: z.enum(ROLES).optional(),
  acceptTerms: z.literal('on', { message: 'Debes aceptar los términos y la política de privacidad' }),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const { displayName, email, password, dateOfBirth, role } = parsed.data;
  // A dónde volver al terminar (p. ej. la invitación de una agencia): solo rutas internas de la lista.
  const after = afterSignupPath(String(formData.get('next') ?? ''));
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  if (after) qs.set('next', after);
  const onboardingUrl = `/onboarding${qs.size ? `?${qs.toString()}` : ''}`;
  const pw = checkNewPassword(password, password);
  if (!pw.ok) return { error: pw.error, fieldErrors: { password: pw.error } };

  // COPPA: se comprueba ANTES de crear nada. La base de datos lo vuelve a exigir.
  const age = checkAge(dateOfBirth);
  if (!age.ok) {
    if (age.reason === 'under_13') {
      return {
        error:
          'Para crear una cuenta hay que tener al menos 13 años. Si eres menor de 13, pide a tu familia que se registre como "Familia".',
      };
    }
    return { fieldErrors: { dateOfBirth: 'Fecha de nacimiento no válida' } };
  }
  if (role && role !== 'athlete' && age.isMinor) {
    return { error: 'Las cuentas de familia, universidad, agente y marca son solo para mayores de edad.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken(formData),
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(onboardingUrl)}`,
      data: { display_name: displayName, date_of_birth: dateOfBirth, signup_role: role ?? null },
    },
  });

  if (error) {
    // No revelamos si un email ya existe (evita enumeración de cuentas).
    return { error: 'No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo.' };
  }

  const { data } = await supabase.auth.getUser();
  if (data.user) await logEvent('signup_completed');
  if (data.user) redirect(onboardingUrl);
  return { ok: true, message: email };
}

/** Reenvía el correo de confirmación. Misma respuesta exista o no la cuenta (sin enumeración). */
export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().email().safeParse(formData.get('email'));
  if (!email.success) return { error: 'Email no válido.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.data, options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` } });
  if (error?.status === 429) return { error: 'Has pedido varios correos seguidos. Espera unos minutos y vuelve a intentarlo.' };
  return { ok: true, message: 'Listo. Si la cuenta está pendiente de confirmar, te llegará un correo nuevo en unos minutos.' };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
  next: z.string().optional(),
});

/** Solo redirecciones internas: evita open redirects vía ?next= (también `/\\dominio`). */
const safeNext = (next: string | undefined) => safeRedirectPath(next, '/app');

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password, options: { captchaToken: captchaToken(formData) } });
  if (error) return { error: 'Email o contraseña incorrectos, o cuenta sin confirmar.' };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') redirect(`/mfa?next=${encodeURIComponent(safeNext(parsed.data.next))}`);
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/**
 * "¿Olvidaste tu contraseña?". Responde siempre lo mismo, exista o no la cuenta,
 * para no revelar qué emails están registrados.
 */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email('Email no válido') }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    captchaToken: captchaToken(formData),
    redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });
  return { ok: true, message: 'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 1 hora.' };
}

/** Guarda la contraseña nueva (requiere la sesión que crea el enlace del email) y cierra las demás sesiones. */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const check = checkNewPassword(password, confirm);
  if (!check.ok) return { error: check.error };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: 'El enlace ha caducado. Pide uno nuevo.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'No se pudo guardar. Prueba otra contraseña o pide un enlace nuevo.' };
  await supabase.auth.signOut({ scope: 'others' });
  redirect('/app?password=updated');
}
