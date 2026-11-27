import type { CompareRow } from '@/lib/domain/recruit-search';

/**
 * Comparación con valores reales lado a lado. En escritorio una tabla (atletas en columnas); en móvil, una tarjeta
 * por dato. Ninguna fila marca «ganador»: la decisión es del staff.
 */
export function CompareTable({ people, rows, caption }: { people: { user_id: string; display_name: string }[]; rows: CompareRow[]; caption: string }) {
  const cell = (c: CompareRow['cells'][number]) => c.href
    ? <a href={c.href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brass underline">{c.text}</a>
    : <span className={c.tone === 'muted' ? 'text-muted' : c.tone === 'ok' ? 'font-semibold text-ok' : 'font-semibold text-paper'}>{c.text}</span>;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
        <table className="w-full text-sm" data-testid="compare-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-40 p-3 text-left text-xs font-bold uppercase tracking-wide text-faint"><span className="sr-only">{caption}</span></th>
              {people.map((p) => <th key={p.user_id} scope="col" className="p-3 text-left font-display text-base font-bold uppercase text-paper">{p.display_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <th scope="row" className="p-3 text-left text-xs font-bold uppercase tracking-wide text-faint">{r.label}</th>
                {r.cells.map((c, i) => <td key={people[i].user_id} className="p-3 align-top">{cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <section key={r.key} className="rounded-2xl border border-line bg-surface p-4" aria-label={r.label}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{r.label}</h2>
            <dl className="space-y-1.5">
              {people.map((p, i) => <div key={p.user_id} className="flex justify-between gap-3"><dt className="text-sm text-muted">{p.display_name}</dt><dd className="text-right">{cell(r.cells[i])}</dd></div>)}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
