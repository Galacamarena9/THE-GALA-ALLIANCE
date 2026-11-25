import { getT } from '@/lib/i18n/server-t';
/**
 * Vista previa del sistema del agente (maqueta en HTML, datos FICTICIOS): procesos en 5 fases y
 * la siguiente acción de cada uno. Es lo que el agente usa a diario, no una captura de pantalla.
 */
const COLUMNS = [
  { phase: 'Introducción', cards: [{ who: 'Marcos J.', where: 'Lakeshore College', next: 'Enviar vídeo completo' }, { who: 'Ana G.', where: 'Westbridge', next: 'Esperando respuesta' }] },
  { phase: 'Evaluación', cards: [{ who: 'Hugo T.', where: 'Northfield Univ.', next: 'Expediente traducido' }] },
  { phase: 'Visita o prueba', cards: [{ who: 'Sofía M.', where: 'Westbrook State', next: 'Preparar visita oficial' }] },
  { phase: 'Oferta', cards: [{ who: 'Lucía M.', where: 'Harbor Tech', next: 'Decide la familia · 3 días', hot: true }] },
  { phase: 'Decisión o colocado', cards: [{ who: 'Pablo R.', where: 'Lakeshore College', next: 'Visado F-1 en marcha' }] },
];

export async function AgentConsole() {
  const tx = await getT();
  return (
    <figure className="overflow-hidden rounded-2xl border border-line-strong bg-night shadow-[var(--shadow-premium)]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /><span className="h-2.5 w-2.5 rounded-full bg-line-strong" /><span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 text-xs text-faint">{tx('Norte Sports · Procesos')}</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.24em] text-faint">{tx('Datos ficticios')}</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
        {COLUMNS.map((col, i) => (
          <div key={tx(col.phase)} className="min-w-0 bg-night p-3">
            <p className="flex items-baseline gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              <span className="text-brass">{String(i + 1).padStart(2, '0')}</span>{tx(col.phase)}
            </p>
            <ul className="mt-3 space-y-2">
              {col.cards.map((c) => (
                <li key={c.who} className={`rounded-lg border p-2.5 ${'hot' in c ? 'border-brass/60 bg-brass/[0.08]' : 'border-line bg-surface'}`}>
                  <p className="break-words text-[13px] font-semibold text-paper">{c.who}</p>
                  <p className="break-words text-[11px] text-faint">{c.where}</p>
                  <p className={`mt-2 break-words text-[11px] ${'hot' in c ? 'font-semibold text-brass' : 'text-muted'}`}><span aria-hidden>→ </span>{tx(c.next)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{tx('Maqueta del tablero de procesos del agente con cinco fases y la siguiente acción de cada atleta (datos ficticios).')}</figcaption>
    </figure>
  );
}
