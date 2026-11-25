'use client';

import { useT } from '@/lib/i18n/client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Field, inputClass } from '@/components/ui';
import { addOrgNote, addOrgTask, addToShortlist, createShortlist, recordOrgOffer, requestInfo, saveNeed, saveProgram, startRecruiting } from '@/app/actions/recruit';
import { INFO_KIND_LABEL } from '@/lib/domain/recruit';

type Opt = { id: string; name: string };
type Pos = { id: number; sport_id: string; name_es: string };

export function NeedForm({ org, sports, positions, programs }: { org: string; sports: Opt[]; positions: Pos[]; programs: Opt[] }) {
  const tx = useT();
  const [sport, setSport] = useState(sports[0]?.id ?? '');
  const [picked, setPicked] = useState<number[]>([]);
  const thisYear = new Date().getFullYear();
  return (
    <ActionForm action={saveNeed} className="grid gap-3 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <input type="hidden" name="positions" value={picked.join(',')} />
          <Field label={tx('Título interno')} htmlFor="nd_title"><input id="nd_title" name="title" required minLength={3} maxLength={120} placeholder={tx('2027 · Base')} className={inputClass} /></Field>
          <Field label={tx('Deporte')} htmlFor="nd_sport"><select id="nd_sport" name="sport_id" value={sport} onChange={(e) => { setSport(e.target.value); setPicked([]); }} className={inputClass}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          {programs.length > 0 && <Field label={tx('Programa')} htmlFor="nd_prog"><select id="nd_prog" name="program_id" className={inputClass}><option value="">{tx('Toda la organización')}</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          <Field label={tx('Años de graduación (coma)')} htmlFor="nd_years"><input id="nd_years" name="years" placeholder={`${thisYear + 1}, ${thisYear + 2}`} className={inputClass} /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-paper">{tx('Posiciones')}</legend>
            <div className="flex flex-wrap gap-2">
              {positions.filter((p) => p.sport_id === sport).map((p) => (
                <label key={p.id} className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-xs ${picked.includes(p.id) ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>
                  <input type="checkbox" className="sr-only" checked={picked.includes(p.id)} onChange={() => setPicked((x) => x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id])} />{p.name_es}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={tx('Plazas')} htmlFor="nd_slots"><input id="nd_slots" type="number" name="slots" min={1} max={50} className={inputClass} /></Field>
          <Field label={tx('Altura mínima (cm)')} htmlFor="nd_h"><input id="nd_h" type="number" name="min_height_cm" min={120} max={230} className={inputClass} /></Field>
          <Field label={tx('Países (ISO, coma)')} htmlFor="nd_c"><input id="nd_c" name="countries" placeholder="ES, FR" className={inputClass} /></Field>
          <Field label={tx('Inicio')} htmlFor="nd_t"><input id="nd_t" name="start_term" placeholder={tx('Fall 2027')} maxLength={40} className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="requires_video" className="h-4 w-4" />{' '}{tx('Exigir highlight reel')}</label>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="requires_documented_academics" className="h-4 w-4" />{' '}{tx('Valorar académico documentado')}</label>
          <div className="sm:col-span-2"><Field label={tx('Notas internas')} htmlFor="nd_n"><textarea id="nd_n" name="internal_notes" rows={2} maxLength={2000} className={inputClass} /></Field></div>
          <p className="text-xs text-muted sm:col-span-2">{tx('Las necesidades son privadas de tu staff. Solo se ven públicamente si publicas una oportunidad.')}</p>
          <div className="sm:col-span-2"><SubmitButton>{tx('Guardar necesidad')}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function ShortlistCreateForm({ org, programs, needs }: { org: string; programs: Opt[]; needs: Opt[] }) {
  const tx = useT();
  return (
    <ActionForm action={createShortlist} className="grid gap-3 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <Field label={tx('Nombre')} htmlFor="sl_name"><input id="sl_name" name="name" required minLength={2} maxLength={80} placeholder={tx('2027 Point Guards')} className={inputClass} /></Field>
          <Field label={tx('Visibilidad')} htmlFor="sl_vis"><select id="sl_vis" name="visibility" className={inputClass}><option value="team">{tx('Toda la organización')}</option><option value="program">{tx('Staff del programa')}</option><option value="shared">{tx('Personas concretas (las eliges después)')}</option><option value="private">{tx('Privada (solo yo)')}</option></select></Field>
          {programs.length > 0 && <Field label={tx('Programa')} htmlFor="sl_prog"><select id="sl_prog" name="program_id" className={inputClass}><option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          {needs.length > 0 && <Field label={tx('Necesidad')} htmlFor="sl_need"><select id="sl_need" name="need_id" className={inputClass}><option value="">—</option>{needs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          <div className="sm:col-span-2"><SubmitButton>{tx('Crear shortlist')}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** "+ Shortlist": elige lista; solo muestra éxito cuando el servidor confirma; si falla, permite reintentar. */
export function AddToShortlist({ athlete, lists, fit, compact = false }: { athlete: string; lists: Opt[]; fit?: number | null; compact?: boolean }) {
  const tx = useT();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string } | null>(null);
  const add = (list: string) => start(async () => {
    const r = await addToShortlist({ list, athlete, fit: fit ?? null });
    setMsg({ ok: r.ok, text: r.message ?? '', list });
    if (r.ok) setOpen(false);
  });
  if (!lists.length) return <Link href="/app/recruit/shortlists" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass">{tx('+ Crear shortlist')}</Link>;
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={pending} className={`inline-flex min-h-11 items-center rounded-full ${compact ? 'px-3' : 'px-4'} bg-brass text-xs font-semibold text-ink`}>{pending ? 'Guardando…' : '+ Shortlist'}</button>
      {open && (
        <div role="dialog" aria-label={tx('Añadir a shortlist')} className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-elevated)]">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{tx('Añadir a')}</p>
          {lists.map((l) => <button key={l.id} type="button" onClick={() => add(l.id)} className="block min-h-11 w-full rounded-xl px-3 text-left text-sm text-paper hover:bg-brass/10">{l.name}</button>)}
          <Link href="/app/recruit/shortlists" className="block min-h-11 rounded-xl px-3 py-3 text-sm text-brass hover:bg-brass/10">{tx('+ Nueva shortlist')}</Link>
        </div>
      )}
      {msg && (
        <p role="status" className={`mt-1 text-xs ${msg.ok ? 'text-ok' : 'text-danger'}`}>
          {msg.ok ? '✓ ' : ''}{msg.text}
          {msg.ok && msg.list && <> · <Link href={`/app/recruit/shortlists/${msg.list}`} className="underline">{tx('Ver')}</Link></>}
          {!msg.ok && msg.list && <> · <button type="button" onClick={() => add(msg.list!)} className="underline">{tx('Reintentar')}</button></>}
        </p>
      )}
    </div>
  );
}

const QUICK = ['Revisar vídeo completo', 'Seguimiento tras el torneo', 'Aclarar información académica', 'Comentar con el head coach'];
export function OrgNoteForm({ org, athlete }: { org: string; athlete: string }) {
  const tx = useT();
  const [body, setBody] = useState('');
  return (
    <ActionForm action={addOrgNote} className="space-y-2">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <div className="flex flex-wrap gap-1.5">{QUICK.map(tx).map((q) => <button key={q} type="button" onClick={() => setBody((b) => (b ? `${b} ` : '') + q)} className="min-h-9 rounded-full border border-line px-3 text-xs text-muted hover:text-paper">{q}</button>)}</div>
          <Field label={tx('Nota interna')} htmlFor={`note-${athlete}`} error={fe.body}>
            {/* El dictado usa el teclado del móvil: nunca activamos el micrófono por nuestra cuenta. */}
            <textarea id={`note-${athlete}`} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} required className={inputClass} placeholder={tx('Puedes dictarla con el micrófono del teclado')} />
          </Field>
          <p className="text-[11px] text-faint">{tx('🔒 Solo tu equipo de recruiting autorizado ve esta nota. Nunca el atleta.')}</p>
          <SubmitButton variant="secondary">{tx('Guardar nota')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OrgTaskForm({ org, athlete, members }: { org: string; athlete?: string; members: Opt[] }) {
  const tx = useT();
  return (
    <ActionForm action={addOrgTask} className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete ?? ''} />
          <Field label={tx('Tarea')} htmlFor={`tk-${athlete ?? 'g'}`} error={fe.title}><input id={`tk-${athlete ?? 'g'}`} name="title" required minLength={2} maxLength={160} placeholder={tx('Ver partido completo')} className={inputClass} /></Field>
          <Field label={tx('Fecha')} htmlFor={`tkd-${athlete ?? 'g'}`}><input id={`tkd-${athlete ?? 'g'}`} type="date" name="due_date" className={inputClass} /></Field>
          <Field label={tx('Asignar a')} htmlFor={`tka-${athlete ?? 'g'}`}><select id={`tka-${athlete ?? 'g'}`} name="assignee" className={inputClass}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <SubmitButton variant="secondary">{tx('Añadir')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InfoRequestForm({ org, athlete, minor }: { org: string; athlete: string; minor: boolean }) {
  const tx = useT();
  return (
    <ActionForm action={requestInfo} className="space-y-2">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <Field label={tx('Qué necesitas')} htmlFor={`ir-${athlete}`}><select id={`ir-${athlete}`} name="kind" className={inputClass}>{Object.entries(INFO_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label={tx('Mensaje')} htmlFor={`irm-${athlete}`} error={fe.message}><textarea id={`irm-${athlete}`} name="message" rows={2} minLength={10} maxLength={1000} required className={inputClass} placeholder={tx('Para qué lo necesitáis')} /></Field>
          <p className="text-[11px] text-faint">{minor ? tx('Atleta menor: la solicitud llega a su familia, que decide.') : tx('El atleta decide si lo comparte y hasta cuándo. Nada se envía automáticamente.')}</p>
          <SubmitButton variant="secondary">{tx('Enviar solicitud')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function StartRecruitingForm({ org, athlete, name, needs, opportunities }: { org: string; athlete: string; name: string; needs: Opt[]; opportunities: Opt[] }) {
  const tx = useT();
  return (
    <ActionForm action={startRecruiting} className="space-y-3">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <p className="text-sm text-paper">{tx('¿Iniciar el proceso de recruiting con')}{' '}<strong>{name}</strong>?</p>
          {needs.length > 0 && <Field label={tx('Necesidad')} htmlFor={`sr-n-${athlete}`}><select id={`sr-n-${athlete}`} name="need_id" className={inputClass}><option value="">—</option>{needs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>}
          {opportunities.length > 0 && <Field label={tx('Oportunidad (si corresponde)')} htmlFor={`sr-o-${athlete}`}><select id={`sr-o-${athlete}`} name="opportunity_id" className={inputClass}><option value="">—</option>{opportunities.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>}
          <label className="flex items-start gap-2 text-xs text-paper"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4" />{tx('Crea un proceso activo en vuestro pipeline. El atleta sigue en la shortlist y no recibe ningún aviso.')}</label>
          {fe.confirm && <p className="text-xs text-danger">{fe.confirm}</p>}
          <SubmitButton>{tx('Iniciar proceso')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OrgOfferForm({ candidate, athlete }: { candidate: string; athlete: string }) {
  const tx = useT();
  return (
    <ActionForm action={recordOrgOffer} className="grid gap-2 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="candidate" value={candidate} /><input type="hidden" name="athlete" value={athlete} />
          <Field label={tx('Coste anual total (USD)')} htmlFor="oo_c"><input id="oo_c" type="number" name="annual_cost" min={0} max={200000} className={inputClass} /></Field>
          <Field label={tx('Ayuda anual (USD)')} htmlFor="oo_a"><input id="oo_a" type="number" name="aid" min={0} max={200000} className={inputClass} /></Field>
          <Field label={tx('Tipo')} htmlFor="oo_t"><select id="oo_t" name="type" className={inputClass}><option value="athletic">{tx('Deportiva')}</option><option value="academic">{tx('Académica')}</option><option value="mixed">{tx('Mixta')}</option><option value="unknown">{tx('Sin especificar')}</option></select></Field>
          <Field label={tx('¿Renovable?')} htmlFor="oo_r"><select id="oo_r" name="renewable" className={inputClass}><option value="unknown">{tx('Sin especificar')}</option><option value="yes">Sí</option><option value="no">No</option></select></Field>
          <Field label={tx('Responder antes de')} htmlFor="oo_d"><input id="oo_d" type="date" name="deadline" className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="in_writing" className="h-4 w-4" />{' '}{tx('Se ha enviado por escrito')}</label>
          <label className="flex items-start gap-2 text-xs text-paper sm:col-span-2"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4" />{tx('Confirmo que es una oferta real autorizada por la institución. El atleta la verá como «Registrada por la organización».')}</label>
          <div className="sm:col-span-2"><SubmitButton>{tx('Registrar oferta')}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function ProgramForm({ org, sports }: { org: string; sports: Opt[] }) {
  const tx = useT();
  return (
    <ActionForm action={saveProgram} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <Field label={tx('Nombre')} htmlFor="pg_n"><input id="pg_n" name="name" required minLength={2} maxLength={120} placeholder={tx('Women\'s Basketball')} className={inputClass} /></Field>
          <Field label={tx('Deporte')} htmlFor="pg_s"><select id="pg_s" name="sport_id" className={inputClass}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label={tx('Categoría')} htmlFor="pg_g"><select id="pg_g" name="gender" className={inputClass}><option value="women">{tx('Femenino')}</option><option value="men">{tx('Masculino')}</option><option value="coed">{tx('Mixto')}</option></select></Field>
          <SubmitButton variant="secondary">{tx('Crear programa')}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
