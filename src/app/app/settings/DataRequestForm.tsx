'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Field, inputClass } from '@/components/ui';
import { submitDataRequest } from '@/app/actions/privacy';

export function DataRequestForm() {
  return (
    <ActionForm action={submitDataRequest} className="grid gap-4 sm:grid-cols-[1fr_2fr]">
      {() => (
        <>
          <Field label="Derecho" htmlFor="request_type">
            <select id="request_type" name="request_type" className={inputClass}>
              <option value="erasure">Supresión (borrar mi cuenta)</option>
              <option value="access">Acceso</option>
              <option value="rectification">Rectificación</option>
              <option value="restriction">Limitación</option>
              <option value="objection">Oposición</option>
              <option value="portability">Portabilidad</option>
            </select>
          </Field>
          <Field label="Detalles (opcional)" htmlFor="details">
            <input id="details" name="details" maxLength={2000} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton variant="secondary">Enviar solicitud</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
