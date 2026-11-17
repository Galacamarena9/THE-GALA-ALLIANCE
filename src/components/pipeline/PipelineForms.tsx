'use client';

import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Field, inputClass } from '@/components/ui';
import { addContact, addProcessOffer, addTask, logInteraction, moveStage, setNextAction } from '@/app/actions/pipeline';
import { CHANNEL_LABEL, CLOSE_REASON, STAGE_INFO, STAGES, type Stage } from '@/lib/domain/pipeline';

function Hidden({ id, athlete }: { id?: string; athlete: string }) {
  return (<>{id !== undefined && <input type="hidden" name="id" value={id} />}<input type="hidden" name="athlete" value={athlete} /></>);
}

export function StageForm({ id, athlete, current }: { id: string; athlete: string; current: string }) {
  const [stage, setStage] = useState<Stage>(current as Stage);
  const final = stage === 'committed' || stage === 'closed';
  return (
    <ActionForm action={moveStage} className="space-y-3">
      {(fe) => (
        <>
          <Hidden id={id} athlete={athlete} />
          <Field label="Etapa" htmlFor="st_status">
            <select id="st_status" name="status" value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={inputClass}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_INFO[s].label}</option>)}
            </select>
          </Field>
          <p className="text-xs text-muted">{STAGE_INFO[stage].hint}</p>
          {stage === 'closed' && (
            <Field label="Motivo" htmlFor="st_reason" error={fe.close_reason}>
              <select id="st_reason" name="close_reason" className={inputClass} defaultValue="">
                <option value="" disabled>Elige un motivo</option>
                {Object.entries(CLOSE_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
          {final && (
            <label className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/5 p-3 text-sm text-paper">
              <input type="checkbox" name="confirm" value="yes" required className="mt-1 h-4 w-4" />
              {stage === 'committed' ? 'Confirmo que esta es mi decisión final. Gala no comunica nada a la universidad por mí.' : 'Confirmo que este proceso no continúa.'}
            </label>
          )}
          <SubmitButton variant={final ? 'primary' : 'secondary'}>{stage === 'committed' ? 'Confirmar compromiso' : 'Guardar etapa'}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function NextActionForm({ id, athlete, action, due }: { id: string; athlete: string; action: string | null; due: string | null }) {
  return (
    <ActionForm action={setNextAction} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      {() => (
        <>
          <Hidden id={id} athlete={athlete} />
          <Field label="Siguiente paso" htmlFor="na_text"><input id="na_text" name="next_action" defaultValue={action ?? ''} maxLength={200} placeholder="Ej.: enviar partido completo al assistant coach" className={inputClass} /></Field>
          <Field label="Fecha" htmlFor="na_due"><input id="na_due" type="date" name="next_action_due" defaultValue={due ?? ''} className={inputClass} /></Field>
          <SubmitButton variant="secondary">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InteractionForm({ id, athlete }: { id: string; athlete: string }) {
  const [kind, setKind] = useState<'interaction' | 'note'>('interaction');
  return (
    <ActionForm action={logInteraction} className="grid gap-3 sm:grid-cols-2">
      {(fe) => (
        <>
          <Hidden id={id} athlete={athlete} />
          <Field label="Tipo" htmlFor="ix_kind">
            <select id="ix_kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'interaction' | 'note')} className={inputClass}>
              <option value="interaction">Interacción (llamada, email, visita…)</option>
              <option value="note">Nota privada</option>
            </select>
          </Field>
          {kind === 'interaction' ? (
            <Field label="Canal" htmlFor="ix_channel"><select id="ix_channel" name="channel" className={inputClass}>{Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          ) : <div className="hidden sm:block" />}
          <Field label="Resumen" htmlFor="ix_title" error={fe.title}><input id="ix_title" name="title" required minLength={2} maxLength={200} className={inputClass} placeholder={kind === 'note' ? 'Ej.: me gusta el programa de Business' : 'Ej.: llamada con el assistant coach'} /></Field>
          <Field label="Fecha" htmlFor="ix_date"><input id="ix_date" type="date" name="occurred_on" className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field label="Detalles (opcional)" htmlFor="ix_body"><textarea id="ix_body" name="body" rows={3} maxLength={2000} className={inputClass} /></Field></div>
          <div className="sm:col-span-2"><SubmitButton variant="secondary">{kind === 'note' ? 'Guardar nota' : 'Registrar interacción'}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function TaskForm({ id, athlete }: { id?: string; athlete: string }) {
  return (
    <ActionForm action={addTask} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      {(fe) => (
        <>
          <Hidden id={id ?? ''} athlete={athlete} />
          <Field label="Nueva tarea" htmlFor={`tk_title_${id ?? 'g'}`} error={fe.title}><input id={`tk_title_${id ?? 'g'}`} name="title" required minLength={2} maxLength={160} className={inputClass} placeholder="Ej.: pedir traducción del expediente" /></Field>
          <Field label="Fecha" htmlFor={`tk_due_${id ?? 'g'}`}><input id={`tk_due_${id ?? 'g'}`} type="date" name="due_date" className={inputClass} /></Field>
          <SubmitButton variant="secondary">Añadir</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ContactForm({ id, athlete }: { id: string; athlete: string }) {
  return (
    <ActionForm action={addContact} className="grid gap-3 sm:grid-cols-2">
      {() => (
        <>
          <Hidden id={id} athlete={athlete} />
          <Field label="Nombre" htmlFor="ct_name"><input id="ct_name" name="name" required minLength={2} maxLength={120} className={inputClass} /></Field>
          <Field label="Cargo" htmlFor="ct_role"><input id="ct_role" name="role" maxLength={80} placeholder="Head coach, admisiones…" className={inputClass} /></Field>
          <Field label="Email" htmlFor="ct_email"><input id="ct_email" type="email" name="email" maxLength={200} className={inputClass} /></Field>
          <Field label="Teléfono" htmlFor="ct_phone"><input id="ct_phone" name="phone" maxLength={25} className={inputClass} /></Field>
          <div className="sm:col-span-2"><SubmitButton variant="secondary">Guardar contacto</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function OfferForm({ id, athlete, defaultName }: { id: string; athlete: string; defaultName: string }) {
  return (
    <ActionForm action={addProcessOffer} className="grid gap-3 sm:grid-cols-2">
      {(fe) => (
        <>
          <Hidden id={id} athlete={athlete} />
          <Field label="Universidad" htmlFor="of_name"><input id="of_name" name="university_name" defaultValue={defaultName} required minLength={2} maxLength={200} className={inputClass} /></Field>
          <Field label="Tipo de beca" htmlFor="of_type"><select id="of_type" name="scholarship_type" className={inputClass}><option value="unknown">No especificado</option><option value="athletic">Deportiva</option><option value="academic">Académica</option><option value="mixed">Mixta</option></select></Field>
          <Field label="Coste anual total (USD)" htmlFor="of_cost" hint="Matrícula + alojamiento + seguro + otros"><input id="of_cost" type="number" name="annual_cost_usd" min={0} max={200000} className={inputClass} /></Field>
          <Field label="Ayuda anual (USD)" htmlFor="of_aid" error={fe.aid_amount_usd}><input id="of_aid" type="number" name="aid_amount_usd" min={0} max={200000} className={inputClass} /></Field>
          <Field label="¿Renovable?" htmlFor="of_ren"><select id="of_ren" name="renewable" className={inputClass}><option value="unknown">No lo sé</option><option value="yes">Sí</option><option value="no">No</option></select></Field>
          <Field label="Responder antes de" htmlFor="of_dl"><input id="of_dl" type="date" name="deadline" className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-paper sm:col-span-2"><input type="checkbox" name="in_writing" className="h-4 w-4" /> La tengo por escrito (email oficial o carta)</label>
          <p className="text-xs text-muted sm:col-span-2">Sin confirmación por escrito, Gala no resta la ayuda del coste neto.</p>
          <div className="sm:col-span-2"><SubmitButton variant="secondary">Registrar oferta</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}
