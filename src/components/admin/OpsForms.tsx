'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { openSupportCase, setFlag } from '@/app/actions/admin-ops';

export function FlagForm({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  return (
    <ActionForm action={setFlag}>
      {() => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="key" value={flagKey} /><input type="hidden" name="enabled" value={enabled ? 'no' : 'yes'} />
          <label className="flex-1 text-xs text-muted">Motivo (obligatorio, queda auditado)<input name="reason" required minLength={10} className={`${inputClass} mt-1 py-1.5`} /></label>
          <SubmitButton variant={enabled ? 'secondary' : 'primary'} pendingText="Guardando…">{enabled ? 'Desactivar' : 'Activar'}</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

export function SupportForm() {
  return (
    <ActionForm action={openSupportCase} className="space-y-3">
      {() => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-muted sm:col-span-2">Asunto<input name="subject" required minLength={3} maxLength={200} className={`${inputClass} mt-1`} /></label>
            <label className="text-sm text-muted">Tema<select name="category" className={`${inputClass} mt-1`} defaultValue="other">
              <option value="account">Mi cuenta</option><option value="verification">Verificación</option><option value="billing">Pagos y facturas</option>
              <option value="safety">Seguridad</option><option value="bug">Algo no funciona</option><option value="data">Mis datos</option><option value="other">Otro</option>
            </select></label>
          </div>
          <label className="block text-sm text-muted">¿Qué ha pasado?<textarea name="body" required minLength={10} maxLength={4000} rows={4} className={`${inputClass} mt-1`} /></label>
          <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
