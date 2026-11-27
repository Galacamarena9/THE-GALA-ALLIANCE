'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { saveOrgSearch } from '@/app/actions/saved-searches';

/** «Guardar esta búsqueda»: nombre + privada o de equipo. Vuelve a lanzarse desde «Hoy» (sin emails todavía). */
export function SaveOrgSearch({ org, need, query }: { org: string; need?: string | null; query: string }) {
  const tx = useT();
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass">{tx('Guardar esta búsqueda')}</button>;
  }
  return (
    <ActionForm action={saveOrgSearch} className="flex w-full flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-3">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <input type="hidden" name="need" value={need ?? ''} />
          <input type="hidden" name="query" value={query} />
          <label className="min-w-56 flex-1 text-xs text-muted">{tx('Nombre de la búsqueda')}
            <input name="name" required minLength={2} maxLength={80} placeholder={tx('p. ej. Bases 2027 con inglés B2')} className={inputClass} />
          </label>
          <label className="text-xs text-muted">{tx('Quién la ve')}
            <select name="visibility" defaultValue="private" className={inputClass}>
              <option value="private">{tx('Solo yo')}</option>
              <option value="team">{tx('Todo el staff')}</option>
            </select>
          </label>
          <SubmitButton pendingText={tx('Guardando…')}>{tx('Guardar')}</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-xs text-muted underline">{tx('Cancelar')}</button>
        </>
      )}
    </ActionForm>
  );
}
