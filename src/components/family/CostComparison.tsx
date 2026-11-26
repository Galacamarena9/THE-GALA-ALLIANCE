import { Badge } from '@/components/ui';
import { AID_LABEL, COST_LABEL, budgetFit, familyCost, type AidKey, type CostKey, type CostScenario } from '@/lib/domain/family-cost';
import { deleteCostScenario } from '@/app/actions/family';
import { getT } from '@/lib/i18n/server-t';

export type ScenarioRow = CostScenario & { id: string; label: string; source_note: string | null };

const money = (n: number, c: CostScenario['currency']) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

const FIT = { within: { label: 'Dentro del presupuesto', tone: 'ok' as const }, over: { label: 'Por encima del presupuesto', tone: 'danger' as const },
  unknown: { label: 'Aún no se puede saber', tone: 'neutral' as const } };

/**
 * Comparación lado a lado. Lo que destaca es lo que falta, no el número más bajo:
 * una opción incompleta nunca aparece como «la más barata».
 */
export async function CostComparison({ scenarios, budget, canDelete = true }: {
  scenarios: ScenarioRow[];
  budget: { amount: number | null; currency: CostScenario['currency'] } | null;
  canDelete?: boolean;
}) {
  const tx = await getT();
  const summaries = scenarios.map((s) => familyCost(s));
  const cell = (v: number | null, c: CostScenario['currency'], unknown = 'Desconocido') =>
    v == null ? <span className="text-warn">{tx(unknown)}</span> : <span className="tabular-nums text-paper">{money(v, c)}</span>;
  const housing = (s: ScenarioRow) => (s.housing == null && s.housing_included ? <span className="text-paper">{tx('Incluido')}</span> : cell(s.housing, s.currency));
  const remove = (s: ScenarioRow) => canDelete && (
    <form action={deleteCostScenario} className="mt-1">
      <input type="hidden" name="id" value={s.id} />
      <button className="min-h-9 hover:text-danger">{tx('Quitar')}</button>
    </form>
  );
  return (
    <div>
      {/* Móvil (< 640 px): una tarjeta por opción, con el coste para la familia primero. Nada queda cortado a 390 px. */}
      <ul className="space-y-3 sm:hidden" aria-label={tx('Comparación de coste anual por opción')}>
        {scenarios.map((s, i) => {
          const r = summaries[i];
          const fit = FIT[budgetFit(r, budget)];
          return (
            <li key={s.id} className="rounded-xl border border-line bg-ink/40 p-3">
              <p className="font-semibold text-paper">{s.label}</p>
              <p className={`mt-1 text-sm ${r.status === 'complete' ? 'font-semibold text-paper' : 'text-warn'}`}>{r.headline}</p>
              <Badge tone={fit.tone} className="mt-2">{tx(fit.label)}</Badge>
              <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
                {(Object.entries(COST_LABEL) as [CostKey, string][]).map(([k, label]) => (
                  <div key={k} className="contents"><dt className="text-muted">{tx(label)}</dt><dd className="text-right">{k === 'housing' ? housing(s) : cell(s[k], s.currency)}</dd></div>
                ))}
                {(Object.entries(AID_LABEL) as [AidKey, string][]).map(([k, label]) => (
                  <div key={k} className="contents"><dt className="text-muted">{tx(label)}</dt><dd className="text-right">{cell(s[k], s.currency, 'Sin confirmar')}</dd></div>
                ))}
              </dl>
              <p className="mt-2 break-words text-xs text-faint">{tx('Fuente')}: {s.source_note ?? '—'}</p>
              {remove(s)}
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">{tx('Comparación de coste anual por opción')}</caption>
        <thead>
          <tr className="text-left text-xs text-faint">
            <th scope="col" className="py-2 font-normal">{tx('Concepto')}</th>
            {scenarios.map((s) => <th key={s.id} scope="col" className="px-2 font-semibold text-paper">{s.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(Object.entries(COST_LABEL) as [CostKey, string][]).map(([k, label]) => (
            <tr key={k}>
              <th scope="row" className="py-2 text-left font-normal text-muted">{tx(label)}</th>
              {scenarios.map((s) => (
                <td key={s.id} className="px-2">
                  {k === 'housing' ? housing(s) : cell(s[k], s.currency)}
                </td>
              ))}
            </tr>
          ))}
          {(Object.entries(AID_LABEL) as [AidKey, string][]).map(([k, label]) => (
            <tr key={k}>
              <th scope="row" className="py-2 text-left font-normal text-muted">{tx(label)}</th>
              {scenarios.map((s) => <td key={s.id} className="px-2">{cell(s[k], s.currency, 'Sin confirmar')}</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-3 text-left font-semibold text-paper">{tx('Coste para la familia')}</th>
            {summaries.map((r, i) => (
              <td key={scenarios[i].id} className="px-2 py-3 align-top">
                <p className={r.status === 'complete' ? 'font-semibold text-paper' : 'text-warn'}>{r.headline}</p>
                <Badge tone={FIT[budgetFit(r, budget)].tone} className="mt-2">{tx(FIT[budgetFit(r, budget)].label)}</Badge>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="py-2 text-left text-xs font-normal text-faint">{tx('Fuente')}</th>
            {scenarios.map((s) => (
              <td key={s.id} className="px-2 py-2 text-xs text-faint">
                {s.source_note ?? '—'}
                {remove(s)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        {tx('Importes en la moneda de la fuente; no convertimos sin un tipo de cambio documentado. «Aún no se puede saber» no descarta una opción: solo dice que falta información.')}
      </p>
    </div>
  );
}
