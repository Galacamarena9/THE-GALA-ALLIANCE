'use client';

import { useActionState, useState } from 'react';
import { updatePassword, type FormState } from '@/app/actions/auth';
import { Field, inputClass, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { PasswordStrength } from '@/components/PasswordStrength';

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, undefined);
  const [pw, setPw] = useState('');
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Contraseña nueva" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={pw} onChange={(e) => setPw(e.target.value)} className={inputClass} />
        <PasswordStrength value={pw} />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
