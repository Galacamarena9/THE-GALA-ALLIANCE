'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { FormState } from '@/app/actions/auth';
import { createRecruitingLink, requestCoachAccess } from '@/app/actions/recruiting';
import { Notice, cx, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

/** Formulario del coach en la ficha pública (inglés). */
export function CoachAccessForm() {
  const [state, action] = useActionState<FormState, FormData>(requestCoachAccess, undefined);
  if (state?.ok) {
    return <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok ring-1 ring-inset ring-ok/25" role="status">{state.message}</p>;
  }
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-muted">Full name
        <input name="name" required autoComplete="name" className={cx(inputClass, 'mt-1')} />
      </label>
      <label className="text-sm text-muted">College email (.edu)
        <input name="email" type="email" required autoComplete="email" placeholder="coach@university.edu" className={cx(inputClass, 'mt-1')} />
      </label>
      <label className="text-sm text-muted sm:col-span-2">Date of birth <span className="text-faint">(staff accounts are 18+)</span>
        <input name="dob" type="date" required className={cx(inputClass, 'mt-1 sm:max-w-[220px]')} />
      </label>
      {state?.error && <div className="sm:col-span-2"><Notice tone="danger">{state.error}</Notice></div>}
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
      </div>
    </form>
  );
}

/** Botón de copiar con confirmación visible. */
export function CopyButton({ text, label = 'Copiar enlace' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-paper transition-colors hover:border-brass/50"
    >
      {done ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{done ? 'Copiado' : label}</span>
    </button>
  );
}

/** Crear un enlace nuevo (atleta adulto o familia de un menor). */
export function NewLinkForm({ athleteId }: { athleteId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createRecruitingLink, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <label className="block text-sm text-muted">¿Para quién es?
        <input name="label" required maxLength={120} placeholder="Coach Smith – Gonzaga University" className={cx(inputClass, 'mt-1')} />
      </label>
      <fieldset>
        <legend className="text-sm text-muted">Caduca en</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {[7, 30, 90].map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="radio" name="days" value={d} defaultChecked={d === 30} className="peer sr-only" />
              <span className="block rounded-xl border border-line-strong py-2 text-center text-sm text-muted transition-colors peer-checked:border-brass peer-checked:bg-brass/10 peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-brass/50">{d} días</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <p className="stamp-in text-xs font-medium text-ok" role="status">✓ {state.message}</p>}
      <SubmitButton pendingText="Creando…" className="w-full">Crear enlace</SubmitButton>
    </form>
  );
}
