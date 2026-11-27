import { Badge } from '@/components/ui';
import { AID_LABEL, COST_LABEL, budgetFit, dual, familyCost, fourYearLine, type AidKey, type CostKey, type CostScenario, type FxRate } from '@/lib/domain/family-cost';
import { deleteCostScenario } from '@/app/actions/family';
import { getT } from '@/lib/i18n/server-t';

export type ScenarioRow = CostScenario & { id: string; label: string; source_note: string | null };

const FIT = { within: { label: 'Dentro del presupuesto', tone: 'ok' as const }, over: { label: 'Por encima del presupuesto', tone: 'danger' as const },
  unknown: { label: 'Aún no se puede saber', tone: 'neutral' as const } };

/**
 * Comparación lado a lado. Lo que destaca es lo que falta, no el número más bajo:
 * una opción incompleta nunca aparece como «la más barata».
 */
export async function CostComparison({ scenarios, budget, fx = null, canDelete = true }: {
  scenarios: ScenarioRow[];
  budget: { amount: number | null; currency: CostScenario['currency'] } | null;
  /** Tipo de cambio indicado por la familia (fecha y fuente). Sin él, solo la moneda de la fuente. */
  fx?: FxRate | null;
  canDelete?: boolean;
}) {
  const tx = await getT();
  const lang = tx.locale === 'en' ? 'en' : 'es';
  const summaries = scenarios.map((s) => familyCost(s, lang));
  // Vacío = «Sin dato» (nunca 0). Con tipo de cambio, también el importe en la otra moneda (USD ↔ EUR).
  const cell = (v: number | null, c: CostScenario['currency'], unknown = 'Sin dato') => {
    if (v == null) return <span className="text-warn">{tx(unknown)}</span>;
    const d = dual(v, c, fx, lang);
    return <span className="tabular-nums text-paper">{d.primary}{d.secondary && <span className="block text-xs text-faint">≈ {d.secondary}</span>}</span>;
  };
  const yearsLine = (i: number) => {
    const line = fourYearLine(summaries[i], fx, lang);
    return line ? <p className="mt-1 text-sm tabular-nums text-paper">{line}</p> : null;
  };
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
          const fit = FIT[budgetFit(r, budget, fx)];
          return (
            <li key={s.id} className="rounded-xl border border-line bg-ink/40 p-3">
              <p className="font-semibold text-paper">{s.label}</p>
              <p className={`mt-1 text-sm ${r.status === 'complete' ? 'font-semibold text-paper' : 'text-warn'}`}>{r.headline}</p>
              {yearsLine(i)}
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
                {yearsLine(i)}
                <Badge tone={FIT[budgetFit(r, budget, fx)].tone} className="mt-2">{tx(FIT[budgetFit(r, budget, fx)].label)}</Badge>
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
        {fx
          ? `${tx('Tipo de cambio indicado por la familia')}: 1 US$ = ${fx.eurPerUsd.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', { maximumFractionDigits: 4 })} € · ${new Date(`${fx.date}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES')} · ${tx('Fuente')}: ${fx.source}. ${tx('Las cifras en la otra moneda son aproximadas.')}`
          : tx('Sin tipo de cambio: los importes se muestran solo en la moneda de la fuente (normalmente dólares). Indica un tipo con su fecha y su fuente para verlos también en euros.')}
        {' '}{tx('A 4 años = el coste de un año multiplicado por 4, sin subidas ni ayudas que no estén por escrito.')}
        {' '}{tx('«Aún no se puede saber» no descarta una opción: solo dice que falta información.')}
      </p>
    </div>
  );
}
