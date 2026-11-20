'use client';

import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { setRepresentationPermissions } from '@/app/actions/marketplace';
import { REP_PERMISSIONS } from '@/lib/domain/portfolio';

/** Qué puede hacer la agencia: el atleta (o su familia) marca y desmarca. Quitar algo se aplica al instante. */
export function RepPermissionsForm({ id, active }: { id: string; active: string[] }) {
  return (
    <ActionForm action={setRepresentationPermissions}>
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <fieldset>
            <legend className="sr-only">Permisos de la agencia</legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {REP_PERMISSIONS.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 text-sm text-paper">
                    <input type="checkbox" name="permission" value={p.id} defaultChecked={active.includes(p.id)} className="accent-[var(--color-brass)]" />
                    {p.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <SubmitButton className="mt-3" pendingText="Guardando…">Guardar permisos</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
