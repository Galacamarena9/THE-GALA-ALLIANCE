import { Badge } from '@/components/ui';
import { AID_LABEL, COST_LABEL, budgetFit, familyCost, type AidKey, type CostKey, type CostScenario } from '@/lib/domain/family-cost';
import { deleteCostScenario } from '@/app/actions/family';

export type ScenarioRow = CostScenario & { id: string; label: string; source_note: string | null };

const money = (n: number, c: CostScenario['currency']) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

const FIT = { within: { label: 'Dentro del presupuesto', tone: 'ok' as const }, over: { label: 'Por encima del presupuesto', tone: 'danger' as const },
  unknown: { label: 'Aún no se puede saber', tone: 'neutral' as const } };

/**
 * Comparación lado a lado. Lo que destaca es lo que falta, no el número más bajo:
 * una opción incompleta nunca aparece como «la más barata».
 */
export function CostComparison({ scenarios, budget, canDelete = true }: {
  scenarios: ScenarioRow[];
  budget: { amount: number | null; currency: CostScenario['currency'] } | null;
  canDelete?: boolean;
}) {
  const summaries = scenarios.map((s) => familyCost(s));
  const cell = (v: number | null, c: CostScenario['currency'], unknown = 'Desconocido') =>
    v == null ? <span className="text-warn">{unknown}</span> : <span className="tabular-nums text-paper">{money(v, c)}</span>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <caption className="sr-only">Comparación de coste anual por opción</caption>
        <thead>
          <tr className="text-left text-xs text-faint">
            <th scope="col" className="py-2 font-normal">Concepto</th>
            {scenarios.map((s) => <th key={s.id} scope="col" className="px-2 font-semibold text-paper">{s.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(Object.entries(COST_LABEL) as [CostKey, string][]).map(([k, label]) => (
            <tr key={k}>
              <th scope="row" className="py-2 text-left font-normal text-muted">{label}</th>
              {scenarios.map((s) => (
                <td key={s.id} className="px-2">
                  {k === 'housing' && s.housing == null && s.housing_included ? <span className="text-paper">Incluido</span> : cell(s[k], s.currency)}
                </td>
              ))}
            </tr>
          ))}
          {(Object.entries(AID_LABEL) as [AidKey, string][]).map(([k, label]) => (
            <tr key={k}>
              <th scope="row" className="py-2 text-left font-normal text-muted">{label}</th>
              {scenarios.map((s) => <td key={s.id} className="px-2">{cell(s[k], s.currency, 'Sin confirmar')}</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-3 text-left font-semibold text-paper">Coste para la familia</th>
            {summaries.map((r, i) => (
              <td key={scenarios[i].id} className="px-2 py-3 align-top">
                <p className={r.status === 'complete' ? 'font-semibold text-paper' : 'text-warn'}>{r.headline}</p>
                <Badge tone={FIT[budgetFit(r, budget)].tone} className="mt-2">{FIT[budgetFit(r, budget)].label}</Badge>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="py-2 text-left text-xs font-normal text-faint">Fuente</th>
            {scenarios.map((s) => (
              <td key={s.id} className="px-2 py-2 text-xs text-faint">
                {s.source_note ?? '—'}
                {canDelete && (
                  <form action={deleteCostScenario} className="mt-1">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="hover:text-danger">Quitar</button>
                  </form>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-faint">
        Importes en la moneda de la fuente; no convertimos sin un tipo de cambio documentado. «Aún no se puede saber» no descarta una opción: solo dice que falta información.
      </p>
    </div>
  );
}
