'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Button, inputClass } from '@/components/ui';
import { flagDiscomfort } from '@/app/actions/connect';
import { useT } from '@/lib/i18n/client';

/**
 * «Esto me incomoda» (QA familia, idea 5): el atleta menor avisa a su familia y al equipo de seguridad sin tener que
 * desvincular ni bloquear a nadie. Visible, en lenguaje sencillo y sin formularios largos.
 */
export function DiscomfortButton({ requestId }: { requestId: string }) {
  const tx = useT();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-xl border border-warn/60 px-4 text-sm font-semibold text-paper hover:bg-warn/10">
        {tx('Esto me incomoda')}
      </button>
    );
  }
  return (
    <ActionForm action={flagDiscomfort} className="mt-2 w-full max-w-md space-y-3 rounded-xl border border-line bg-ink/60 p-4">
      {() => (
        <>
          <input type="hidden" name="request_id" value={requestId} />
          <p className="text-sm text-paper">{tx('Avisaremos a tu familia y al equipo de seguridad de Gala. No tienes que desvincular a nadie ni dar explicaciones.')}</p>
          <label htmlFor={`discomfort-${requestId}`} className="block text-xs text-muted">{tx('Si quieres, cuéntanos qué ha pasado (opcional)')}</label>
          <textarea id={`discomfort-${requestId}`} name="note" rows={2} maxLength={500} className={inputClass} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText={tx('Enviando…')}>{tx('Avisar a mi familia y a seguridad')}</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{tx('Cancelar')}</Button>
          </div>
          <p className="text-xs text-faint">{tx('Si hay un riesgo inmediato, llama al 112.')}</p>
        </>
      )}
    </ActionForm>
  );
}
