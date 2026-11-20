'use client';

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
  const [sport, setSport] = useState(sports[0]?.id ?? '');
  const [picked, setPicked] = useState<number[]>([]);
  const thisYear = new Date().getFullYear();
  return (
    <ActionForm action={saveNeed} className="grid gap-3 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <input type="hidden" name="positions" value={picked.join(',')} />
          <Field label="Título interno" htmlFor="nd_title"><input id="nd_title" name="title" required minLength={3} maxLength={120} placeholder="2027 · Base" className={inputClass} /></Field>
          <Field label="Deporte" htmlFor="nd_sport"><select id="nd_sport" name="sport_id" value={sport} onChange={(e) => { setSport(e.target.value); setPicked([]); }} className={inputClass}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          {programs.length > 0 && <Field label="Programa" htmlFor="nd_prog"><select id="nd_prog" name="program_id" className={inputClass}><option value="">Toda la organización</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          <Field label="Años de graduación (coma)" htmlFor="nd_years"><input id="nd_years" name="years" placeholder={`${thisYear + 1}, ${thisYear + 2}`} className={inputClass} /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-paper">Posiciones</legend>
            <div className="flex flex-wrap gap-2">
              {positions.filter((p) => p.sport_id === sport).map((p) => (
                <label key={p.id} className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-xs ${picked.includes(p.id) ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>
                  <input type="checkbox" className="sr-only" checked={picked.includes(p.id)} onChange={() => setPicked((x) => x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id])} />{p.name_es}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Plazas" htmlFor="nd_slots"><input id="nd_slots" type="number" name="slots" min={1} max={50} className={inputClass} /></Field>
          <Field label="Altura mínima (cm)" htmlFor="nd_h"><input id="nd_h" type="number" name="min_height_cm" min={120} max={230} className={inputClass} /></Field>
          <Field label="Países (ISO, coma)" htmlFor="nd_c"><input id="nd_c" name="countries" placeholder="ES, FR" className={inputClass} /></Field>
          <Field label="Inicio" htmlFor="nd_t"><input id="nd_t" name="start_term" placeholder="Fall 2027" maxLength={40} className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="requires_video" className="h-4 w-4" /> Exigir highlight reel</label>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="requires_documented_academics" className="h-4 w-4" /> Valorar académico documentado</label>
          <div className="sm:col-span-2"><Field label="Notas internas" htmlFor="nd_n"><textarea id="nd_n" name="internal_notes" rows={2} maxLength={2000} className={inputClass} /></Field></div>
          <p className="text-xs text-muted sm:col-span-2">Las necesidades son privadas de tu staff. Solo se ven públicamente si publicas una oportunidad.</p>
          <div className="sm:col-span-2"><SubmitButton>Guardar necesidad</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function ShortlistCreateForm({ org, programs, needs }: { org: string; programs: Opt[]; needs: Opt[] }) {
  return (
    <ActionForm action={createShortlist} className="grid gap-3 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <Field label="Nombre" htmlFor="sl_name"><input id="sl_name" name="name" required minLength={2} maxLength={80} placeholder="2027 Point Guards" className={inputClass} /></Field>
          <Field label="Visibilidad" htmlFor="sl_vis"><select id="sl_vis" name="visibility" className={inputClass}><option value="team">Toda la organización</option><option value="program">Staff del programa</option><option value="shared">Personas concretas (las eliges después)</option><option value="private">Privada (solo yo)</option></select></Field>
          {programs.length > 0 && <Field label="Programa" htmlFor="sl_prog"><select id="sl_prog" name="program_id" className={inputClass}><option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          {needs.length > 0 && <Field label="Necesidad" htmlFor="sl_need"><select id="sl_need" name="need_id" className={inputClass}><option value="">—</option>{needs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
          <div className="sm:col-span-2"><SubmitButton>Crear shortlist</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

/** "+ Shortlist": elige lista; solo muestra éxito cuando el servidor confirma; si falla, permite reintentar. */
export function AddToShortlist({ athlete, lists, fit, compact = false }: { athlete: string; lists: Opt[]; fit?: number | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string } | null>(null);
  const add = (list: string) => start(async () => {
    const r = await addToShortlist({ list, athlete, fit: fit ?? null });
    setMsg({ ok: r.ok, text: r.message ?? '', list });
    if (r.ok) setOpen(false);
  });
  if (!lists.length) return <Link href="/app/recruit/shortlists" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass">+ Crear shortlist</Link>;
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={pending} className={`inline-flex min-h-11 items-center rounded-full ${compact ? 'px-3' : 'px-4'} bg-brass text-xs font-semibold text-ink`}>{pending ? 'Guardando…' : '+ Shortlist'}</button>
      {open && (
        <div role="dialog" aria-label="Añadir a shortlist" className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-elevated)]">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Añadir a</p>
          {lists.map((l) => <button key={l.id} type="button" onClick={() => add(l.id)} className="block min-h-11 w-full rounded-xl px-3 text-left text-sm text-paper hover:bg-brass/10">{l.name}</button>)}
          <Link href="/app/recruit/shortlists" className="block min-h-11 rounded-xl px-3 py-3 text-sm text-brass hover:bg-brass/10">+ Nueva shortlist</Link>
        </div>
      )}
      {msg && (
        <p role="status" className={`mt-1 text-xs ${msg.ok ? 'text-ok' : 'text-danger'}`}>
          {msg.ok ? '✓ ' : ''}{msg.text}
          {msg.ok && msg.list && <> · <Link href={`/app/recruit/shortlists/${msg.list}`} className="underline">Ver</Link></>}
          {!msg.ok && msg.list && <> · <button type="button" onClick={() => add(msg.list!)} className="underline">Reintentar</button></>}
        </p>
      )}
    </div>
  );
}

const QUICK = ['Revisar vídeo completo', 'Seguimiento tras el torneo', 'Aclarar información académica', 'Comentar con el head coach'];
export function OrgNoteForm({ org, athlete }: { org: string; athlete: string }) {
  const [body, setBody] = useState('');
  return (
    <ActionForm action={addOrgNote} className="space-y-2">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <div className="flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} type="button" onClick={() => setBody((b) => (b ? `${b} ` : '') + q)} className="min-h-9 rounded-full border border-line px-3 text-xs text-muted hover:text-paper">{q}</button>)}</div>
          <Field label="Nota interna" htmlFor={`note-${athlete}`} error={fe.body}>
            {/* El dictado usa el teclado del móvil: nunca activamos el micrófono por nuestra cuenta. */}
            <textarea id={`note-${athlete}`} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} required className={inputClass} placeholder="Puedes dictarla con el micrófono del teclado" />
          </Field>
          <p className="text-[11px] text-faint">🔒 Solo tu equipo de recruiting autorizado ve esta nota. Nunca el atleta.</p>
          <SubmitButton variant="secondary">Guardar nota</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OrgTaskForm({ org, athlete, members }: { org: string; athlete?: string; members: Opt[] }) {
  return (
    <ActionForm action={addOrgTask} className="grid gap-2 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete ?? ''} />
          <Field label="Tarea" htmlFor={`tk-${athlete ?? 'g'}`} error={fe.title}><input id={`tk-${athlete ?? 'g'}`} name="title" required minLength={2} maxLength={160} placeholder="Ver partido completo" className={inputClass} /></Field>
          <Field label="Fecha" htmlFor={`tkd-${athlete ?? 'g'}`}><input id={`tkd-${athlete ?? 'g'}`} type="date" name="due_date" className={inputClass} /></Field>
          <Field label="Asignar a" htmlFor={`tka-${athlete ?? 'g'}`}><select id={`tka-${athlete ?? 'g'}`} name="assignee" className={inputClass}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <SubmitButton variant="secondary">Añadir</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InfoRequestForm({ org, athlete, minor }: { org: string; athlete: string; minor: boolean }) {
  return (
    <ActionForm action={requestInfo} className="space-y-2">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <Field label="Qué necesitas" htmlFor={`ir-${athlete}`}><select id={`ir-${athlete}`} name="kind" className={inputClass}>{Object.entries(INFO_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Mensaje" htmlFor={`irm-${athlete}`} error={fe.message}><textarea id={`irm-${athlete}`} name="message" rows={2} minLength={10} maxLength={1000} required className={inputClass} placeholder="Para qué lo necesitáis" /></Field>
          <p className="text-[11px] text-faint">{minor ? 'Atleta menor: la solicitud llega a su familia, que decide.' : 'El atleta decide si lo comparte y hasta cuándo. Nada se envía automáticamente.'}</p>
          <SubmitButton variant="secondary">Enviar solicitud</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function StartRecruitingForm({ org, athlete, name, needs, opportunities }: { org: string; athlete: string; name: string; needs: Opt[]; opportunities: Opt[] }) {
  return (
    <ActionForm action={startRecruiting} className="space-y-3">
      {(fe) => (
        <>
          <input type="hidden" name="org" value={org} /><input type="hidden" name="athlete" value={athlete} />
          <p className="text-sm text-paper">¿Iniciar el proceso de recruiting con <strong>{name}</strong>?</p>
          {needs.length > 0 && <Field label="Necesidad" htmlFor={`sr-n-${athlete}`}><select id={`sr-n-${athlete}`} name="need_id" className={inputClass}><option value="">—</option>{needs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>}
          {opportunities.length > 0 && <Field label="Oportunidad (si corresponde)" htmlFor={`sr-o-${athlete}`}><select id={`sr-o-${athlete}`} name="opportunity_id" className={inputClass}><option value="">—</option>{opportunities.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>}
          <label className="flex items-start gap-2 text-xs text-paper"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4" />Crea un proceso activo en vuestro pipeline. El atleta sigue en la shortlist y no recibe ningún aviso.</label>
          {fe.confirm && <p className="text-xs text-danger">{fe.confirm}</p>}
          <SubmitButton>Iniciar proceso</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function OrgOfferForm({ candidate, athlete }: { candidate: string; athlete: string }) {
  return (
    <ActionForm action={recordOrgOffer} className="grid gap-2 sm:grid-cols-2">
      {() => (
        <>
          <input type="hidden" name="candidate" value={candidate} /><input type="hidden" name="athlete" value={athlete} />
          <Field label="Coste anual total (USD)" htmlFor="oo_c"><input id="oo_c" type="number" name="annual_cost" min={0} max={200000} className={inputClass} /></Field>
          <Field label="Ayuda anual (USD)" htmlFor="oo_a"><input id="oo_a" type="number" name="aid" min={0} max={200000} className={inputClass} /></Field>
          <Field label="Tipo" htmlFor="oo_t"><select id="oo_t" name="type" className={inputClass}><option value="athletic">Deportiva</option><option value="academic">Académica</option><option value="mixed">Mixta</option><option value="unknown">Sin especificar</option></select></Field>
          <Field label="¿Renovable?" htmlFor="oo_r"><select id="oo_r" name="renewable" className={inputClass}><option value="unknown">Sin especificar</option><option value="yes">Sí</option><option value="no">No</option></select></Field>
          <Field label="Responder antes de" htmlFor="oo_d"><input id="oo_d" type="date" name="deadline" className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm text-paper"><input type="checkbox" name="in_writing" className="h-4 w-4" /> Se ha enviado por escrito</label>
          <label className="flex items-start gap-2 text-xs text-paper sm:col-span-2"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4" />Confirmo que es una oferta real autorizada por la institución. El atleta la verá como «Registrada por la organización».</label>
          <div className="sm:col-span-2"><SubmitButton>Registrar oferta</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function ProgramForm({ org, sports }: { org: string; sports: Opt[] }) {
  return (
    <ActionForm action={saveProgram} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-end">
      {() => (
        <>
          <input type="hidden" name="org" value={org} />
          <Field label="Nombre" htmlFor="pg_n"><input id="pg_n" name="name" required minLength={2} maxLength={120} placeholder="Women's Basketball" className={inputClass} /></Field>
          <Field label="Deporte" htmlFor="pg_s"><select id="pg_s" name="sport_id" className={inputClass}>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Categoría" htmlFor="pg_g"><select id="pg_g" name="gender" className={inputClass}><option value="women">Femenino</option><option value="men">Masculino</option><option value="coed">Mixto</option></select></Field>
          <SubmitButton variant="secondary">Crear programa</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
