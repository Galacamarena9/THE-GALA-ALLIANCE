'use client';

import { useActionState } from 'react';
import { addCredential } from '@/app/actions/credentials';
import type { FormState } from '@/app/actions/auth';
import { Notice, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

export function CredentialForm({ agencyId }: { agencyId: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(addCredential, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.message}</Notice>}
      {agencyId && <input type="hidden" name="organization_id" value={agencyId} />}
      <label className="block text-xs text-muted">Organismo emisor<input name="issuing_body" required placeholder="Ej.: FIBA, FIFA, federación nacional" className={inputClass} /></label>
      <label className="block text-xs text-muted">Tipo
        <select name="credential_type" className={inputClass} defaultValue="federation_license">
          <option value="federation_license">Licencia de federación</option>
          <option value="league_registration">Registro en una liga</option>
          <option value="jurisdiction_registration">Registro oficial de un país</option>
          <option value="professional_certification">Certificación profesional</option>
          <option value="other">Otra</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">Número (privado)<input name="credential_number" className={inputClass} /></label>
        <label className="block text-xs text-muted">País<input name="country" maxLength={2} placeholder="ES" className={inputClass} /></label>
      </div>
      <label className="block text-xs text-muted">Caduca<input type="date" name="expires_on" className={inputClass} /></label>
      <SubmitButton pendingText="Guardando…" className="min-h-12 w-full justify-center">Añadir credencial</SubmitButton>
    </form>
  );
}
