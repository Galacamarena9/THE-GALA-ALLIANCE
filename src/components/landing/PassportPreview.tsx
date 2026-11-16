import { BadgeCheck, FileCheck2, PenLine, PlayCircle } from 'lucide-react';

/**
 * Vista previa ilustrativa del Opportunity Passport (persona ficticia).
 * Muestra el principio de procedencia: cada dato indica si es declarado, documentado o confirmado por el club.
 */
const ROWS: { label: string; value: string; source: 'club' | 'doc' | 'self' }[] = [
  { label: 'Puntos por partido 2025-26', value: '14,2', source: 'club' },
  { label: 'Nota media', value: '8,7 / 10', source: 'doc' },
  { label: 'Inglés', value: 'C1', source: 'doc' },
  { label: 'Altura', value: '1,78 m', source: 'self' },
];
const SOURCE = {
  club: { text: 'Confirmado por el club', Icon: BadgeCheck, cls: 'text-ok' },
  doc: { text: 'Documentado', Icon: FileCheck2, cls: 'text-brass' },
  self: { text: 'Declarado', Icon: PenLine, cls: 'text-muted' },
} as const;

export function PassportPreview() {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 text-paper shadow-[var(--shadow-premium)]">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brass to-brass-deep font-display text-xl font-bold text-white">LM</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-brass">Opportunity Passport · ejemplo</p>
          <p className="truncate text-base font-bold">Lucía M.</p>
          <p className="text-xs text-muted">Baloncesto · Base · Promoción 2027 · Valencia</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 py-2.5 text-xs">
        <PlayCircle className="h-4 w-4 text-brass" aria-hidden />Highlight reel y partido completo
      </div>
      <ul className="mt-4 divide-y divide-line text-xs">
        {ROWS.map(({ label, value, source }) => {
          const s = SOURCE[source];
          return (
            <li key={label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-muted">{label}</span>
              <span className="flex items-center gap-3">
                <span className="font-bold">{value}</span>
                <span className={`flex items-center gap-1 ${s.cls}`}><s.Icon className="h-3.5 w-3.5" aria-hidden />{s.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs"><span className="font-bold">Recruiting Readiness</span><span className="tabular-nums">72/100</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full w-[72%] rounded-full bg-brass" /></div>
      </div>
    </div>
  );
}
