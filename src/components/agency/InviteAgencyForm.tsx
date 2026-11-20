'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inviteAgency } from '@/app/actions/marketplace';
import { inputClass } from '@/components/ui';

/** Invitar a una agencia verificada a enviar su propuesta. Solo aparecen agencias verificadas. */
export function InviteAgencyForm({ agencies, athleteId }: { agencies: { id: string; name: string }[]; athleteId?: string }) {
  if (!agencies.length) return <p className="text-sm text-muted">Todavía no hay agencias verificadas disponibles.</p>;
  return (
    <ActionForm action={inviteAgency}>
      {() => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {athleteId && <input type="hidden" name="athlete_id" value={athleteId} />}
          <label className="flex-1 text-sm text-muted">
            Agencia verificada
            <select name="agency_id" required className={`${inputClass} mt-1`} defaultValue="">
              <option value="" disabled>Elige una agencia…</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <SubmitButton pendingText="Enviando…">Invitar a proponer</SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}
