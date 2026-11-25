'use client';

import { useT } from '@/lib/i18n/client';
import { useState, useTransition } from 'react';
import { quickAssign, quickNote } from '@/app/actions/recruit';
import { inputClass } from '@/components/ui';

/** Atajos de nota para el pabellón: un toque rellena el texto; el scout puede completarlo (o dictarlo con el teclado del móvil). */
const QUICK = ['Revisar partido completo', 'Comentar con el entrenador', 'Pedir vídeo reciente', 'Comprobar equipo actual', 'Hacer seguimiento'];

type Result = { ok: boolean; message: string } | null;

/**
 * Nota interna y asignación desde la Vista rápida, sin salir de Discovery.
 * Nunca muestra «guardado» antes de que el servidor confirme; sin conexión, lo dice y no finge.
 */
export function ScoutSheets({ org, athlete, members }: { org: string; athlete: string; members: { id: string; name: string }[] }) {
  const tx = useT();
  const [mode, setMode] = useState<'note' | 'assign' | null>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [res, setRes] = useState<Result>(null);
  const [pending, start] = useTransition();

  const offline = () => typeof navigator !== 'undefined' && !navigator.onLine;
  const submit = () => start(async () => {
    if (offline()) { setRes({ ok: false, message: tx('Necesitas conexión para guardar. No se ha guardado nada.') }); return; }
    const r = mode === 'note'
      ? await quickNote({ org, athlete, body: text })
      : await quickAssign({ org, athlete, assignee, task: text, due });
    setRes(r);
    if (r.ok) { setText(''); setMode(null); }
  });
  const toggle = (m: 'note' | 'assign') => { setRes(null); setText(m === 'assign' ? tx('Revisar partido completo') : ''); setMode(mode === m ? null : m); };

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => toggle('note')} aria-expanded={mode === 'note'} className="min-h-11 flex-1 rounded-full border border-line px-3 text-sm font-semibold text-paper">{tx('Nota')}</button>
        {members.length > 0 && <button type="button" onClick={() => toggle('assign')} aria-expanded={mode === 'assign'} className="min-h-11 flex-1 rounded-full border border-line px-3 text-sm font-semibold text-paper">{tx('Asignar')}</button>}
      </div>
      {mode && (
        <div className="mt-3 space-y-2 rounded-2xl border border-line bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">{mode === 'note' ? tx('Nota interna') : tx('Asignar a')}</p>
          {mode === 'assign' && (
            <label className="block text-xs text-muted">{tx('Persona del staff')}
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputClass}>
                <option value="">{tx('Elige…')}</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-1.5" aria-label={tx('Atajos')}>
            {QUICK.map(tx).map((q) => <button key={q} type="button" onClick={() => setText((t) => (mode === 'note' && t ? `${t} · ${q}` : q))} className="min-h-9 rounded-full border border-line px-3 text-xs text-muted">{q}</button>)}
          </div>
          <label className="block text-xs text-muted">{mode === 'note' ? tx('Texto (puedes dictarlo con el teclado del móvil)') : tx('Tarea')}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={mode === 'note' ? 3 : 2} maxLength={mode === 'note' ? 2000 : 160} className={inputClass} />
          </label>
          {mode === 'assign' && <label className="block text-xs text-muted">{tx('Para (opcional)')}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} /></label>}
          {mode === 'note' && <p className="text-[11px] text-muted">{tx('Solo la ven los miembros autorizados de tu organización. El atleta y su familia nunca la ven.')}</p>}
          <button type="button" disabled={pending || !text.trim() || (mode === 'assign' && !assignee)} onClick={submit} className="min-h-11 w-full rounded-full bg-brass px-4 text-sm font-semibold text-ink disabled:opacity-50">
            {pending ? 'Guardando…' : mode === 'note' ? tx('Guardar nota') : tx('Asignar')}
          </button>
        </div>
      )}
      {res && <p role={res.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${res.ok ? 'text-ok' : 'text-danger'}`}>{res.ok ? `✓ ${res.message}` : res.message}</p>}
    </div>
  );
}
