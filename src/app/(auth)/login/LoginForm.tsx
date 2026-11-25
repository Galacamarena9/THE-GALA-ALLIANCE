'use client';

import { useT } from '@/lib/i18n/client';
import { useActionState } from 'react';
import { Captcha } from '@/components/Captcha';
import Link from 'next/link';
import { signIn, type FormState } from '@/app/actions/auth';
import { Field, inputClass, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function LoginForm({ next }: { next?: string }) {
  const tx = useT();
  const [state, action] = useActionState<FormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Notice tone="danger">{tx(state.error)}</Notice>}
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label={tx('Contraseña')} htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <p className="-mt-2 text-right text-sm"><Link href="/forgot-password" className="text-brass hover:underline">{tx('¿Olvidaste tu contraseña?')}</Link></p>
      <Captcha />
      <SubmitButton className="w-full" pendingText={tx('Entrando…')}>{tx('Entrar')}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {tx('¿Aún no tienes cuenta?')}{' '}<Link href="/signup" className="text-brass hover:underline">{tx('Crear cuenta')}</Link>
      </p>
    </form>
  );
}
