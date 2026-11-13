'use client';

import { useActionState, type ReactNode } from 'react';
import type { FormState } from '@/app/actions/auth';
import { Notice } from '@/components/ui';

/**
 * Formulario genérico sobre una Server Action que devuelve FormState.
 * Muestra errores y confirmación, y pasa los errores de campo a los hijos.
 * Úsalo desde componentes cliente (children es una función).
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: (fieldErrors: Record<string, string>) => ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <div className="mb-4"><Notice tone="danger">{state.error}</Notice></div>}
      {children(state?.fieldErrors ?? {})}
      {state?.ok && state.message && (
        <p className="stamp-in mt-3 inline-block rounded border border-ok/50 px-2 py-0.5 text-xs font-medium text-ok" role="status">
          ✓ {state.message}
        </p>
      )}
    </form>
  );
}
