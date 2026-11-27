'use client';

import { ActionForm } from '@/components/ActionForm';
import { formatUsd } from '@/lib/i18n/format';
import { SubmitButton } from '@/components/SubmitButton';
import { inputClass } from '@/components/ui';
import { addFamilyNote, addFamilyTask, deleteFamilyNote, saveCostScenario, saveFamilyBudget, saveFamilyFx } from '@/app/actions/family';
import { useT } from '@/lib/i18n/client';
import { AID_LABEL, COST_LABEL, type AidKey, type CostKey } from '@/lib/domain/family-cost';
import type { FamilyNote } from '@/lib/data/family-home';

export function FamilyNotes({ athleteId, notes }: { athleteId: string; notes: FamilyNote[] }) {
  return (
    <div>
      {notes.length ? (
        <ul className="mb-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="whitespace-pre-wrap text-paper">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-faint">
                <span>{n.author} · {n.visibility === 'family' ? 'compartida con el atleta' : 'solo tutores'}</span>
                {n.mine && (
                  <form action={deleteFamilyNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="hover:text-danger">Borrar</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-muted">Apuntad dudas y conversaciones: «¿cuánto cuesta de verdad el alojamiento?», «nos gusta pero está lejos». Ninguna universidad ni club las ve.</p>
      )}
      <ActionForm action={addFamilyNote} className="grid gap-2">
        {() => (
          <>
            <input type="hidden" name="athlete" value={athleteId} />
            <label htmlFor="family-note" className="sr-only">Nueva nota</label>
            <textarea id="family-note" name="body" required maxLength={2000} rows={2} placeholder="Escribe una nota…" className={inputClass} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs text-muted">
                Quién la ve{' '}
                <select name="visibility" defaultValue="guardians" className="ml-1 rounded-md border border-line bg-transparent px-2 py-1 text-xs text-paper">
                  <option value="guardians">Solo tutores</option>
                  <option value="family">También el atleta</option>
                </select>
              </label>
              <SubmitButton pendingText="Guardando…">Guardar nota</SubmitButton>
            </div>
          </>
        )}
      </ActionForm>
    </div>
  );
}

export function FamilyTaskForm({ athleteId }: { athleteId: string }) {
  return (
    <ActionForm action={addFamilyTask} className="grid gap-2">
      {() => (
        <>
          <input type="hidden" name="athlete" value={athleteId} />
          <label htmlFor="family-task" className="text-xs text-muted">Tarea</label>
          <input id="family-task" name="title" required minLength={3} maxLength={160} placeholder="Revisar el coste de alojamiento de la Universidad X" className={inputClass} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted">Fecha (opcional)<input name="due" type="date" className={inputClass} /></label>
            <label className="grid gap-1 text-xs text-muted">
              Responsable
              <select name="owner" defaultValue="both" className={inputClass}>
                <option value="both">Juntos (atleta y familia)</option>
                <option value="guardian">Solo familia</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-faint">Aparece en el mismo plan de tareas que usa tu hijo/a: no hay dos listas.</p>
          <SubmitButton pendingText="Creando…">Crear tarea</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const COSTS = Object.entries(COST_LABEL) as [CostKey, string][];
const AIDS = Object.entries(AID_LABEL) as [AidKey, string][];

export function CostScenarioForm({ athleteId, offers }: { athleteId: string; offers: { id: string; label: string }[] }) {
  return (
    <ActionForm action={saveCostScenario} className="grid gap-4">
      {() => (
        <>
          <input type="hidden" name="athlete" value={athleteId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-muted sm:col-span-2">Opción<input name="label" required minLength={2} maxLength={120} placeholder="Universidad X" className={inputClass} /></label>
            <label className="grid gap-1 text-xs text-muted">
              Moneda de la fuente
              <select name="currency" defaultValue="USD" className={inputClass}><option>USD</option><option>EUR</option><option>GBP</option></select>
            </label>
          </div>
          {offers.length > 0 && (
            <label className="grid gap-1 text-xs text-muted">
              Vincular a una oferta (opcional)
              <select name="offer" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {offers.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          <fieldset className="grid gap-3 sm:grid-cols-4">
            <legend className="mb-1 text-sm font-medium text-paper">Costes anuales publicados</legend>
            {COSTS.map(([k, label]) => (
              <label key={k} className="grid gap-1 text-xs text-muted">{label}<input name={k} inputMode="numeric" pattern="\d*" placeholder="Sin dato" className={inputClass} /></label>
            ))}
            <label className="grid gap-1 text-xs text-muted">
              Alojamiento incluido
              <select name="housing_included" defaultValue="" className={inputClass}><option value="">No se sabe</option><option value="yes">Sí</option><option value="no">No</option></select>
            </label>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-1 text-sm font-medium text-paper">Ayuda confirmada por escrito</legend>
            {AIDS.map(([k, label]) => (
              <label key={k} className="grid gap-1 text-xs text-muted">{label}<input name={k} inputMode="numeric" pattern="\d*" placeholder="Sin confirmar" className={inputClass} /></label>
            ))}
          </fieldset>
          <label className="grid gap-1 text-xs text-muted">Fuente (opcional)<input name="source_note" maxLength={500} placeholder="Web oficial de la universidad, carta de oferta…" className={inputClass} /></label>
          <p className="text-xs text-faint">Deja en blanco lo que no sepas: contará como «sin dato», nunca como 0. Seguro médico y viajes (vuelos, visitas) son parte del coste real: si aún no los sabes, déjalos en blanco y la cifra se mostrará como «coste mínimo conocido». Solo la familia y el atleta ven esto.</p>
          <SubmitButton pendingText="Guardando…">Guardar opción</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function BudgetForm({ athleteId, amount, mode, canEdit }: { athleteId: string; amount: number | null; mode: 'preference' | 'hard_limit'; canEdit: boolean }) {
  if (!canEdit) {
    return <p className="text-sm text-muted">{amount != null ? `Presupuesto anual: ${formatUsd(amount, 'es')} (${mode === 'hard_limit' ? 'límite' : 'preferencia'}).` : 'Sin presupuesto definido.'} Para cambiarlo necesitas el permiso de presupuesto (y, si el atleta es mayor de edad, también el de editar su perfil).</p>;
  }
  return (
    <ActionForm action={saveFamilyBudget} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {() => (
        <>
          <input type="hidden" name="athlete" value={athleteId} />
          <label className="grid gap-1 text-xs text-muted">Aportación anual máxima (US$)<input name="amount" inputMode="numeric" pattern="\d*" defaultValue={amount ?? ''} placeholder="15000" className={inputClass} /></label>
          <label className="grid gap-1 text-xs text-muted">
            Tipo
            <select name="mode" defaultValue={mode} className={inputClass}>
              <option value="preference">Preferencia</option>
              <option value="hard_limit">Límite estricto</option>
            </select>
          </label>
          <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Tipo de cambio de la familia: los tres datos o ninguno. Sin tipo, todo se ve solo en la moneda de la fuente. */
export function FxForm({ athleteId, fx }: { athleteId: string; fx: { eurPerUsd: number; date: string; source: string } | null }) {
  const tx = useT();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm action={saveFamilyFx} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
      {() => (
        <>
          <input type="hidden" name="athlete" value={athleteId} />
          <label className="grid gap-1 text-xs text-muted">{tx('1 US$ = … €')}<input name="rate" inputMode="decimal" defaultValue={fx ? String(fx.eurPerUsd).replace('.', ',') : ''} placeholder={tx('Sin tipo')} className={inputClass} /></label>
          <label className="grid gap-1 text-xs text-muted">{tx('Fecha del tipo')}<input name="date" type="date" max={today} defaultValue={fx?.date ?? ''} className={inputClass} /></label>
          <label className="grid gap-1 text-xs text-muted">{tx('Fuente')}<input name="source" maxLength={200} defaultValue={fx?.source ?? ''} placeholder={tx('BCE, tu banco…')} className={inputClass} /></label>
          <SubmitButton pendingText={tx('Guardando…')}>{tx('Guardar')}</SubmitButton>
          <p className="text-xs text-faint sm:col-span-4">{tx('No proponemos ningún tipo: copia el de una fuente que conozcas, con su fecha. Deja los tres campos vacíos para quitarlo.')}</p>
        </>
      )}
    </ActionForm>
  );
}
