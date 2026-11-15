'use client';

import { useActionState } from 'react';
import { Captcha } from '@/components/Captcha';
import Link from 'next/link';
import { signUp, type FormState } from '@/app/actions/auth';
import { Field, inputClass, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function SignupForm({ role }: { role?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, undefined);

  if (state?.ok) {
    return (
      <Notice tone="ok">
        <p className="font-medium">Revisa tu correo</p>
        <p className="mt-1 text-muted">{state.message}</p>
      </Notice>
    );
  }

  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {role && <input type="hidden" name="role" value={role} />}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Nombre y apellidos" htmlFor="displayName" error={fe.displayName}>
        <input id="displayName" name="displayName" autoComplete="name" required className={inputClass} />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint="Mínimo 10 caracteres." error={fe.password}>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>
      <Field
        label="Fecha de nacimiento"
        htmlFor="dateOfBirth"
        hint="Nunca se muestra en tu perfil. La usamos para aplicar protecciones a menores."
        error={fe.dateOfBirth}
      >
        <input id="dateOfBirth" name="dateOfBirth" type="date" required className={inputClass} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-[var(--color-brass)]" />
        <span>
          Acepto los <Link className="text-brass hover:underline" href="/legal/terminos" target="_blank">términos</Link> y he leído la{' '}
          <Link className="text-brass hover:underline" href="/legal/privacidad" target="_blank">política de privacidad</Link>.
        </span>
      </label>
      {fe.acceptTerms && <p className="-mt-3 text-xs text-danger">{fe.acceptTerms}</p>}
      <Captcha />
      <SubmitButton className="w-full" pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta? <Link href="/login" className="text-brass hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
