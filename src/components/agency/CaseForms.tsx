'use client';

import { useActionState, useRef, useEffect } from 'react';
import type { FormState } from '@/app/actions/auth';
import { openCase, updateCase, logActivity, addTask, addContact, importContacts } from '@/app/actions/agency-cases';
import { CASE_PHASES, CASE_STAGES, stageLabel } from '@/lib/domain/agency-cases';
import { Field, inputClass } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';

type Opt = { id: string; name: string };

function Status({ state }: { state: FormState }) {
  if (state?.ok) return <span className="text-xs text-ok" role="status">{state.message}</span>;
  if (state?.error) return <span className="text-xs text-danger" role="alert">{state.error}</span>;
  return null;
}

/** Vacía el formulario tras guardar bien. */
function useResetOnOk(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return ref;
}

export function OpenCaseForm({ agencies, athletes, contacts, sports, cycles }: {
  agencies: Opt[]; athletes: (Opt & { agencyId: string; sportId: string | null })[];
  contacts: (Opt & { agencyId: string })[]; sports: Opt[]; cycles: string[];
}) {
  const [state, action] = useActionState<FormState, FormData>(openCase, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {agencies.length > 1 ? (
        <Field label="Agencia" htmlFor="oc-agency">
          <select id="oc-agency" name="agency_id" className={inputClass}>{agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
      ) : <input type="hidden" name="agency_id" value={agencies[0]?.id} />}
      <Field label="Atleta" htmlFor="oc-athlete" hint="Solo atletas que han aceptado tu representación.">
        <select id="oc-athlete" name="athlete_id" required className={inputClass} defaultValue="">
          <option value="" disabled>Elige…</option>
          {athletes.map((a) => <option key={`${a.agencyId}-${a.id}`} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Universidad o programa" htmlFor="oc-inst">
        <input id="oc-inst" name="institution_name" required maxLength={200} className={inputClass} placeholder="Ej. University of Example" />
      </Field>
      <Field label="Deporte" htmlFor="oc-sport">
        <select id="oc-sport" name="sport_id" className={inputClass} defaultValue={athletes[0]?.sportId ?? ''}>
          <option value="">Sin indicar</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Temporada de llegada" htmlFor="oc-cycle">
        <select id="oc-cycle" name="cycle" className={inputClass} defaultValue={cycles[1]}>{cycles.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Paso inicial (fase Introducción)" htmlFor="oc-stage">
        <select id="oc-stage" name="stage" className={inputClass} defaultValue="research">
          {CASE_STAGES.slice(0, 5).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Contacto en el programa" htmlFor="oc-contact">
        <select id="oc-contact" name="contact_id" className={inputClass} defaultValue="">
          <option value="">Ninguno todavía</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Próxima acción" htmlFor="oc-next">
        <input id="oc-next" name="next_action" maxLength={300} className={inputClass} placeholder="Ej. Enviar vídeo al assistant coach" />
      </Field>
      <Field label="Fecha de la próxima acción" htmlFor="oc-due">
        <input id="oc-due" name="next_action_due" type="date" className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Abriendo…">Abrir proceso</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

export function UpdateCaseForm({ c, members, contacts, disabled }: {
  c: { id: string; stage: string; ownerId: string | null; contactId: string | null; nextAction: string | null; nextActionDue: string | null; outcomeReason: string | null };
  members: Opt[]; contacts: Opt[]; disabled?: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateCase, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={c.id} />
      <fieldset disabled={disabled} className="contents">
        <Field label="Paso del proceso" htmlFor="uc-stage">
          {/* Los 13 pasos internos, agrupados en las 5 fases visibles del tablero (vocabulario único). */}
          <select id="uc-stage" name="stage" defaultValue={c.stage} className={inputClass}>
            {CASE_PHASES.map((p) => (
              <optgroup key={p.id} label={`Fase: ${p.label}`}>
                {p.stages.map((id) => <option key={id} value={id}>{stageLabel(id)}</option>)}
              </optgroup>
            ))}
            <option value="closed">{stageLabel('closed')}</option>
          </select>
        </Field>
        <Field label="Responsable" htmlFor="uc-owner">
          <select id="uc-owner" name="owner_id" defaultValue={c.ownerId ?? ''} className={inputClass}>
            <option value="">Sin asignar</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Contacto en el programa" htmlFor="uc-contact">
          <select id="uc-contact" name="contact_id" defaultValue={c.contactId ?? ''} className={inputClass}>
            <option value="">Ninguno</option>
            {contacts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha de la próxima acción" htmlFor="uc-due">
          <input id="uc-due" type="date" name="next_action_due" defaultValue={c.nextActionDue ?? ''} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Próxima acción" htmlFor="uc-next">
            <input id="uc-next" name="next_action" maxLength={300} defaultValue={c.nextAction ?? ''} className={inputClass} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Motivo del cambio" htmlFor="uc-reason" hint="Queda en el historial. Obligatorio en la práctica al cerrar un proceso.">
            <input id="uc-reason" name="outcome_reason" maxLength={500} defaultValue={c.outcomeReason ?? ''} className={inputClass} />
          </Field>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
          <Status state={state} />
        </div>
      </fieldset>
    </form>
  );
}

const KINDS = [
  { id: 'email', label: 'Email' }, { id: 'call', label: 'Llamada' }, { id: 'meeting', label: 'Reunión o visita' },
  { id: 'message', label: 'Mensaje' }, { id: 'note', label: 'Nota interna' },
];

export function ActivityForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(logActivity, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="grid gap-2 sm:grid-cols-[10rem_10rem_1fr]">
        <label className="sr-only" htmlFor="act-kind">Tipo</label>
        <select id="act-kind" name="kind" className={inputClass}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        <label className="sr-only" htmlFor="act-date">Fecha</label>
        <input id="act-date" type="date" name="occurred_on" className={inputClass} />
        <label className="sr-only" htmlFor="act-body">Qué pasó</label>
        <input id="act-body" name="body" required maxLength={5000} placeholder="Qué pasó, en una o dos frases" className={inputClass} />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Registrando…">Registrar</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

export function TaskForm({ caseId, members }: { caseId: string; members: Opt[] }) {
  const [state, action] = useActionState<FormState, FormData>(addTask, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem_10rem]">
        <label className="sr-only" htmlFor="task-title">Tarea</label>
        <input id="task-title" name="title" required maxLength={200} placeholder="Ej. Pedir expediente académico" className={inputClass} />
        <label className="sr-only" htmlFor="task-who">Responsable</label>
        <select id="task-who" name="assignee_id" className={inputClass} defaultValue="">
          <option value="">Sin responsable</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="task-due">Fecha</label>
        <input id="task-due" type="date" name="due_date" className={inputClass} />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Creando…">Añadir tarea</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ContactForm({ agencies, sports }: { agencies: Opt[]; sports: Opt[] }) {
  const [state, action] = useActionState<FormState, FormData>(addContact, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      {agencies.length > 1 ? (
        <Field label="Agencia" htmlFor="ct-agency">
          <select id="ct-agency" name="agency_id" className={inputClass}>{agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
      ) : <input type="hidden" name="agency_id" value={agencies[0]?.id} />}
      <Field label="Universidad o programa" htmlFor="ct-inst"><input id="ct-inst" name="institution_name" required maxLength={200} className={inputClass} /></Field>
      <Field label="Deporte" htmlFor="ct-sport">
        <select id="ct-sport" name="sport_id" className={inputClass} defaultValue="">
          <option value="">Sin indicar</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Nombre" htmlFor="ct-name"><input id="ct-name" name="name" required maxLength={120} className={inputClass} /></Field>
      <Field label="Cargo" htmlFor="ct-role"><input id="ct-role" name="role_title" maxLength={120} placeholder="Ej. Assistant Coach" className={inputClass} /></Field>
      <Field label="Email profesional" htmlFor="ct-email"><input id="ct-email" name="email" type="email" className={inputClass} /></Field>
      <Field label="Teléfono" htmlFor="ct-phone"><input id="ct-phone" name="phone" maxLength={40} className={inputClass} /></Field>
      <div className="sm:col-span-2">
        <Field label="Notas" htmlFor="ct-notes" hint="Solo tu agencia lo ve. Guarda lo mínimo: es información de otra persona.">
          <textarea id="ct-notes" name="notes" rows={2} maxLength={2000} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Guardando…">Guardar contacto</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ImportContactsForm({ agencies }: { agencies: Opt[] }) {
  const [state, action] = useActionState<FormState, FormData>(importContacts, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      {agencies.length > 1 ? (
        <Field label="Agencia" htmlFor="im-agency">
          <select id="im-agency" name="agency_id" className={inputClass}>{agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
      ) : <input type="hidden" name="agency_id" value={agencies[0]?.id} />}
      <Field label="Archivo CSV" htmlFor="im-file" hint="Desde Excel o Google Sheets: Archivo → Descargar/Guardar como CSV. Primera fila con títulos: Universidad, Nombre y, si los tienes, Cargo, Email, Teléfono, Notas.">
        <input id="im-file" name="file" type="file" accept=".csv,text/csv" required className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-night file:px-3 file:py-2 file:text-sm file:font-semibold file:text-lime" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Importando…">Importar contactos</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}
