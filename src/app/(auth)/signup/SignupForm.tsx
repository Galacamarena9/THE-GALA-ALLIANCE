'use client';

import { useT } from '@/lib/i18n/client';
import { useActionState } from 'react';
import { Captcha } from '@/components/Captcha';
import Link from 'next/link';
import { resendConfirmation, signUp, type FormState } from '@/app/actions/auth';
import { Field, inputClass, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function SignupForm({ role, next }: { role?: string; next?: string }) {
  const tx = useT();
  const [state, action] = useActionState<FormState, FormData>(signUp, undefined);

  if (state?.ok) return <CheckEmail email={state.message ?? ''} />;

  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {role && <input type="hidden" name="role" value={role} />}
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Notice tone="danger">{tx(state.error)}</Notice>}
      <Field label={tx('Nombre y apellidos')} htmlFor="displayName" error={fe.displayName && tx(fe.displayName)}>
        <input id="displayName" name="displayName" autoComplete="name" required className={inputClass} />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email && tx(fe.email)}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label={tx('Contraseña')} htmlFor="password" hint={tx('Mínimo 10 caracteres.')} error={fe.password && tx(fe.password)}>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </Field>
      <Field
        label={tx('Fecha de nacimiento')}
        htmlFor="dateOfBirth"
        hint={tx('Nunca se muestra en tu perfil. La usamos para aplicar protecciones a menores.')}
        error={fe.dateOfBirth && tx(fe.dateOfBirth)}
      >
        <input id="dateOfBirth" name="dateOfBirth" type="date" required className={inputClass} />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 h-4 w-4 accent-[var(--color-brass)]" />
        <span>
          {tx('Acepto los')}{' '}<Link className="text-brass hover:underline" href="/legal/terminos" target="_blank">{tx('términos')}</Link> y he leído la{' '}
          <Link className="text-brass hover:underline" href="/legal/privacidad" target="_blank">{tx('política de privacidad')}</Link>.
        </span>
      </label>
      {fe.acceptTerms && <p className="-mt-3 text-xs text-danger">{tx(fe.acceptTerms)}</p>}
      <Captcha />
      <SubmitButton className="w-full" pendingText={tx('Creando cuenta…')}>{tx('Crear cuenta')}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {tx('¿Ya tienes cuenta?')}{' '}<Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-brass hover:underline">{tx('Entrar')}</Link>
      </p>
    </form>
  );
}

function CheckEmail({ email }: { email: string }) {
  const tx = useT();
  const [resent, resend] = useActionState<FormState, FormData>(resendConfirmation, undefined);
  return (
    <div className="space-y-4">
      <Notice tone="ok">
        <p className="font-semibold">{tx('Revisa tu correo')}</p>
        <p className="mt-1">{tx('Te hemos enviado un enlace a')}{' '}<strong>{email}</strong>{' '}{tx('para confirmar la cuenta. Ábrelo desde este mismo dispositivo.')}</p>
      </Notice>
      <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">
        <p className="font-semibold text-paper">{tx('¿No te llega?')}</p>
        <ul className="mt-2 space-y-1.5">
          <li>{tx('• Mira en spam o en promociones; puede tardar un par de minutos.')}</li>
          <li>{tx('• Si ya tenías una cuenta con este email no enviamos otro correo:')}{' '}<Link href="/login" className="text-brass underline underline-offset-2">{tx('inicia sesión')}</Link> o <Link href="/forgot-password" className="text-brass underline underline-offset-2">{tx('crea una contraseña nueva')}</Link>.</li>
        </ul>
        <form action={resend} className="mt-3">
          <input type="hidden" name="email" value={email} />
          <SubmitButton pendingText={tx('Enviando…')}>{tx('Reenviar el correo')}</SubmitButton>
        </form>
        {resent?.ok && <p className="mt-2 text-ok" role="status">{tx(resent.message ?? '')}</p>}
        {resent?.error && <p className="mt-2 text-danger" role="alert">{tx(resent.error)}</p>}
      </div>
    </div>
  );
}
