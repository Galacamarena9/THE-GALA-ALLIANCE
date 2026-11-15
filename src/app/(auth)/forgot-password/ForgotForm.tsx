'use client';

import { useActionState } from 'react';
import { Captcha } from '@/components/Captcha';
import Link from 'next/link';
import { requestPasswordReset, type FormState } from '@/app/actions/auth';
import { Field, inputClass, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, undefined);
  if (state?.ok) {
    return (
      <div className="space-y-5">
        <Notice tone="ok">{state.message}</Notice>
        <p className="text-sm text-muted">¿No llega? Revisa la carpeta de spam o <Link href="/forgot-password" className="text-brass hover:underline">vuelve a intentarlo</Link>.</p>
        <Link href="/login" className="block text-center text-sm text-brass hover:underline">Volver a entrar</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Captcha />
      <SubmitButton className="w-full" pendingText="Enviando…">Enviarme el enlace</SubmitButton>
      <p className="text-center text-sm text-muted"><Link href="/login" className="text-brass hover:underline">Volver a entrar</Link></p>
    </form>
  );
}
