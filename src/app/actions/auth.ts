'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { checkAge } from '@/lib/domain/age';
import { siteUrl } from '@/lib/env';

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
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding${role ? `?role=${role}` : ''}`,
      data: { display_name: displayName, date_of_birth: dateOfBirth, signup_role: role ?? null },
    },
  });

  if (error) {
    // No revelamos si un email ya existe (evita enumeración de cuentas).
    return { error: 'No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo.' };
  }

  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(`/onboarding${role ? `?role=${role}` : ''}`);
  return { ok: true, message: `Te hemos enviado un email a ${email}. Ábrelo para confirmar tu cuenta y continuar.` };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
  next: z.string().optional(),
});

/** Solo redirecciones internas: evita open redirects vía ?next=. */
function safeNext(next: string | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: 'Email o contraseña incorrectos, o cuenta sin confirmar.' };
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
