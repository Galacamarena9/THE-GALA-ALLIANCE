'use client';

import { useMemo, useState } from 'react';
import { COST_LABELS, computeNetCost, type AidInputs, type CostInputs, type Offer } from '@/lib/domain/netCost';
import { Button, Card, CardTitle, Notice, cx, inputClass } from '@/components/ui';

const usd = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const emptyCosts = (): CostInputs => ({ tuition: null, fees: null, housing: null, meals: null, insurance: null, books: null, travel: null, visa: null, other: null });
const emptyAid = (): AidInputs => ({ athleticConfirmed: null, academicConfirmed: null, otherConfirmed: null, estimated: null });
const newOffer = (n: number): Offer => ({ id: `o${n}`, name: `Opción ${n}`, costs: emptyCosts(), aid: emptyAid(), years: 4, annualIncreasePct: 3 });

function NumberInput({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step={100}
        inputMode="numeric"
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
        className="w-32 shrink-0 rounded-lg border border-line-strong bg-ink px-3 py-1.5 text-right text-sm tabular-nums text-paper placeholder:text-faint hover:border-faint focus:border-brass focus:outline-none"
        aria-label={label}
      />
    </label>
  );
}

export function NetCostCalculator() {
  const [offers, setOffers] = useState<Offer[]>([newOffer(1)]);
  const [active, setActive] = useState(0);
  const offer = offers[active];
  const results = useMemo(() => offers.map(computeNetCost), [offers]);
  const r = results[active];

  const update = (patch: Partial<Offer>) => setOffers((os) => os.map((o, i) => (i === active ? { ...o, ...patch } : o)));
  const setCost = (k: keyof CostInputs, v: number | null) => update({ costs: { ...offer.costs, [k]: v } });
  const setAid = (k: keyof AidInputs, v: number | null) => update({ aid: { ...offer.aid, [k]: v } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Opciones a comparar">
        {offers.map((o, i) => (
          <button key={o.id} aria-pressed={i === active} onClick={() => setActive(i)} className={cx('rounded-full border px-4 py-1.5 text-sm', i === active ? 'border-brass text-brass' : 'border-line-strong text-muted hover:text-paper')}>
            {o.name}
          </button>
        ))}
        {offers.length < 5 && <Button variant="ghost" onClick={() => { setOffers((os) => [...os, newOffer(os.length + 1)]); setActive(offers.length); }}>+ Añadir opción</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <label className="mb-4 block">
            <span className="text-xs text-faint">Nombre de la opción</span>
            <input value={offer.name} onChange={(e) => update({ name: e.target.value.slice(0, 60) })} className={inputClass} />
          </label>
          <CardTitle kicker="Coste anual (USD)">Lo que cuesta</CardTitle>
          <div className="space-y-2.5">
            {(Object.keys(COST_LABELS) as (keyof CostInputs)[]).map((k) => <NumberInput key={k} label={COST_LABELS[k]} value={offer.costs[k]} onChange={(v) => setCost(k, v)} />)}
          </div>
          <div className="mt-6"><CardTitle kicker="Ayudas anuales (USD)">Lo que te cubren</CardTitle></div>
          <div className="space-y-2.5">
            <NumberInput label="Beca deportiva (confirmada por escrito)" value={offer.aid.athleticConfirmed} onChange={(v) => setAid('athleticConfirmed', v)} />
            <NumberInput label="Beca académica (confirmada)" value={offer.aid.academicConfirmed} onChange={(v) => setAid('academicConfirmed', v)} />
            <NumberInput label="Otras ayudas (confirmadas)" value={offer.aid.otherConfirmed} onChange={(v) => setAid('otherConfirmed', v)} />
            <NumberInput label="Ayuda estimada (aún sin confirmar)" value={offer.aid.estimated} onChange={(v) => setAid('estimated', v)} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="text-muted">Años</span><input type="number" min={1} max={5} value={offer.years} onChange={(e) => update({ years: Math.min(5, Math.max(1, Number(e.target.value) || 4)) })} className={inputClass} /></label>
            <label className="text-sm"><span className="text-muted">Subida anual de costes %</span><input type="number" min={0} max={15} step={0.5} value={offer.annualIncreasePct} onChange={(e) => update({ annualIncreasePct: Math.min(15, Math.max(0, Number(e.target.value) || 0)) })} className={inputClass} /></label>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="paper-grain">
            <CardTitle kicker="Resultado">{offer.name}</CardTitle>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Coste bruto / año</dt><dd className="font-display text-2xl tabular-nums text-paper">{usd(r.gross)}</dd></div>
              <div className="rounded-xl bg-ink/50 p-4"><dt className="text-xs text-faint">Ayuda confirmada</dt><dd className="font-display text-2xl tabular-nums text-ok">{usd(r.confirmed)}</dd></div>
              <div className="col-span-2 rounded-xl border border-brass/40 bg-ink/50 p-4"><dt className="text-xs text-brass">Aportación familiar estimada / año</dt><dd className="font-display text-4xl tabular-nums text-paper">{usd(r.familyFirstYear)}</dd><dd className="text-xs text-faint">≈ {usd(r.monthly)} al mes</dd></div>
            </dl>
            <table className="mt-5 w-full text-sm">
              <thead className="text-left text-xs text-faint"><tr><th className="font-normal">Escenario</th><th className="text-right font-normal">1.er año</th><th className="text-right font-normal">Total {offer.years} años</th></tr></thead>
              <tbody className="divide-y divide-line">
                {([['Prudente', r.conservative, 'Solo ayuda confirmada y costes +10 %'], ['Esperado', r.expected, 'Confirmada + mitad de la estimada'], ['Optimista', r.optimistic, 'Confirmada + toda la estimada']] as const).map(([n, s, hint]) => (
                  <tr key={n}><td className="py-2 text-paper">{n}<span className="block text-xs text-faint">{hint}</span></td><td className="text-right tabular-nums">{usd(s.firstYear)}</td><td className="text-right tabular-nums text-paper">{usd(s.total)}</td></tr>
                ))}
              </tbody>
            </table>
            {r.unknownCosts.length > 0 && <div className="mt-4"><Notice tone="warn">Faltan partidas: {r.unknownCosts.map((k) => COST_LABELS[k as keyof CostInputs]).join(', ')}. El total real será mayor: pide estos importes a la universidad.</Notice></div>}
          </Card>

          {offers.length > 1 && (
            <Card>
              <CardTitle kicker="Comparador">Tus opciones lado a lado</CardTitle>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-faint"><tr><th className="font-normal">Opción</th><th className="text-right font-normal">Bruto</th><th className="text-right font-normal">Familia/año</th><th className="text-right font-normal">Total prudente</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {offers.map((o, i) => {
                    const best = Math.min(...results.map((x) => x.conservative.total)) === results[i].conservative.total;
                    return (
                      <tr key={o.id} className={best ? 'text-ok' : ''}><td className="py-2 text-paper">{o.name}{best && ' ★'}</td><td className="text-right tabular-nums">{usd(results[i].gross)}</td><td className="text-right tabular-nums">{usd(results[i].familyFirstYear)}</td><td className="text-right tabular-nums">{usd(results[i].conservative.total)}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          <p className="text-xs text-faint">Estimación orientativa en USD, sin tipo de cambio. No es una oferta ni asesoramiento financiero. Usa las calculadoras oficiales de cada universidad y confirma todo por escrito. No guardamos estos datos.</p>
        </div>
      </div>
    </div>
  );
}
