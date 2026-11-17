'use client';

import { useRef, useState } from 'react';
import { importScorecardBatch } from '@/app/actions/admin';
import { Button } from '@/components/ui';

/**
 * Importa el catálogo completo de College Scorecard por lotes de 300. Cada lote es una llamada al servidor
 * (Netlify), así nunca supera el tiempo máximo de una función. Se puede cancelar y reanudar desde la última página.
 */
export function ScorecardBulkImport() {
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const cancel = useRef(false);

  async function run(from: number) {
    cancel.current = false;
    setRunning(true);
    setMsg(null);
    let next: number | null = from;
    let count = from === 0 ? 0 : done;
    while (next != null && !cancel.current) {
      const r = await importScorecardBatch(next);
      if (!r.ok) { setMsg({ tone: 'error', text: r.error }); setPage(next); setRunning(false); return; }
      count += r.imported;
      setDone(count);
      setTotal(r.total);
      next = r.nextPage;
      if (next != null) setPage(next);
    }
    setRunning(false);
    if (cancel.current) setMsg({ tone: 'error', text: `Importación pausada en la página ${next}. Puedes reanudarla.` });
    else { setPage(0); setMsg({ tone: 'ok', text: `Catálogo completo: ${count} instituciones importadas o actualizadas.` }); }
  }

  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Todas las instituciones activas de EE. UU. con grado asociado, grado o posgrado (donde existen NCAA, NAIA y JUCO), con coste, admisión y web oficiales.
        La división deportiva no viene en College Scorecard: se completa en cada ficha.
      </p>
      <div className="flex flex-wrap gap-2">
        {!running && <Button type="button" onClick={() => run(page === 0 ? 0 : page)}>{page === 0 ? 'Importar catálogo completo' : `Reanudar desde la página ${page}`}</Button>}
        {!running && page !== 0 && <Button type="button" variant="secondary" onClick={() => { setDone(0); setPage(0); void run(0); }}>Empezar de cero</Button>}
        {running && <Button type="button" variant="secondary" onClick={() => { cancel.current = true; }}>Pausar</Button>}
      </div>
      {(running || done > 0) && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted"><span>{running ? 'Importando…' : 'Progreso'}</span><span className="tabular-nums">{done}{total ? ` de ${total}` : ''}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progreso de la importación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-brass transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {msg && <p role="status" className={`text-sm ${msg.tone === 'ok' ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>}
    </div>
  );
}
