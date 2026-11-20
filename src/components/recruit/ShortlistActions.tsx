'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { assignWithTask, promoteFromShortlist, type PromoteResult } from '@/app/actions/recruit';
import { inputClass } from '@/components/ui';

type Opt = { id: string; name: string };

/** «Iniciar recruiting» con confirmación explícita (nunca con un toque accidental) y estado real de éxito. */
export function PromoteSheet({ list, athlete, name, program, needs, opportunities, defaultNeed }: {
  list: string; athlete: string; name: string; program: string | null; needs: Opt[]; opportunities: Opt[]; defaultNeed?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState(defaultNeed ?? '');
  const [opp, setOpp] = useState('');
  const [res, setRes] = useState<PromoteResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) {
    return (
      <div role="status" className="rounded-xl border border-ok/40 bg-ok/5 p-3 text-sm">
        <p className="font-semibold text-ok">✓ {res.message}</p>
        <div className="mt-2 flex gap-2">
          <Link href={`/app/recruit/candidates/${athlete}`} className="inline-flex min-h-11 items-center rounded-full bg-brass px-4 text-xs font-semibold text-ink">Ver en el pipeline</Link>
          <button type="button" onClick={() => { setRes(null); setOpen(false); }} className="min-h-11 rounded-full border border-line px-4 text-xs text-paper">Seguir en la lista</button>
        </div>
      </div>
    );
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full border border-brass/50 px-4 text-xs font-semibold text-brass">Iniciar recruiting</button>;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3" role="group" aria-label="Confirmar inicio del proceso">
      <p className="text-sm font-semibold text-paper">¿Iniciar el proceso de recruiting?</p>
      <dl className="text-xs text-muted"><div>Atleta: <span className="text-paper">{name}</span></div>{program && <div>Programa: <span className="text-paper">{program}</span></div>}</dl>
      {needs.length > 0 && <label className="block text-xs text-muted">Necesidad<select value={need} onChange={(e) => setNeed(e.target.value)} className={inputClass}><option value="">—</option>{needs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>}
      {opportunities.length > 0 && <label className="block text-xs text-muted">Oportunidad (si corresponde)<select value={opp} onChange={(e) => setOpp(e.target.value)} className={inputClass}><option value="">—</option>{opportunities.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>}
      <p className="text-xs text-muted">Se creará un proceso activo en vuestro pipeline. El atleta sigue en esta shortlist y no recibe ningún aviso.</p>
      {res && !res.ok && <p role="alert" className="text-xs text-danger">{res.message}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => start(async () => setRes(await promoteFromShortlist({ list, athlete, need: need || undefined, opportunity: opp || undefined })))}
          className="min-h-12 flex-1 rounded-full bg-brass px-4 text-sm font-semibold text-ink">{pending ? 'Creando…' : 'Iniciar proceso'}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-full border border-line px-4 text-sm text-paper">Cancelar</button>
      </div>
    </div>
  );
}

/** Asignar a un miembro autorizado y, si se quiere, crear la tarea en el mismo paso. */
export function AssignSheet({ list, athlete, members, current }: { list: string; athlete: string; members: Opt[]; current: string | null }) {
  const [assignee, setAssignee] = useState(current ?? '');
  const [task, setTask] = useState('');
  const [due, setDue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Asignar a</legend>
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-xs ${assignee === '' ? 'border-brass text-brass' : 'border-line text-paper'}`}><input type="radio" className="sr-only" checked={assignee === ''} onChange={() => setAssignee('')} />Sin asignar</label>
          {members.map((m) => <label key={m.id} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-xs ${assignee === m.id ? 'border-brass bg-brass/10 text-brass' : 'border-line text-paper'}`}><input type="radio" className="sr-only" checked={assignee === m.id} onChange={() => setAssignee(m.id)} />{m.name}</label>)}
        </div>
      </fieldset>
      <div className="grid grid-cols-[1fr_140px] gap-2">
        <label className="text-xs text-muted">Tarea (opcional)<input value={task} onChange={(e) => setTask(e.target.value)} maxLength={160} placeholder="Ver partido completo" className={inputClass} /></label>
        <label className="text-xs text-muted">Fecha<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} /></label>
      </div>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await assignWithTask({ list, athlete, assignee: assignee || null, task: task || undefined, due }); setMsg({ ok: r.ok, text: r.message }); if (r.ok) setTask(''); })}
        className="min-h-11 w-full rounded-full bg-brass px-4 text-sm font-semibold text-ink">{pending ? 'Guardando…' : 'Asignar'}</button>
      {msg && <p role="status" className={`text-xs ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.ok ? '✓ ' : ''}{msg.text}</p>}
    </div>
  );
}
