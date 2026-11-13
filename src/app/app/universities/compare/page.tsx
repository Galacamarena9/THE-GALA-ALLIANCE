import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadPassport } from '@/lib/data/athlete';
import { institutionFit } from '@/lib/domain/institutionFit';
import { DIVISION_LABEL, domainOf, usd } from '@/lib/domain/labels';
import { logEvent } from '@/lib/events';
import type { Division } from '@/lib/types';
import { Badge, Card, CardTitle, EmptyState, PageHeader, inputClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Comparar universidades' };

const MAX = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Inst {
  id: string; name: string; city: string | null; state: string | null; division: Division | null; conference: string | null;
  sports_offered: string[]; website_url: string | null; price_calculator_url: string | null; athletics_url: string | null;
  international_url: string | null; cost_attendance_usd: number | null; tuition_out_of_state_usd: number | null;
  sat_avg: number | null; admission_rate: number | null; data_source: string | null; source_fetched_at: string | null;
}

const href = (ids: string[]) => `/app/universities/compare${ids.length ? `?ids=${ids.join(',')}` : ''}`;

export default async function CompareUniversitiesPage({ searchParams }: { searchParams: Promise<{ ids?: string; q?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const ids = [...new Set((sp.ids ?? '').split(',').filter((x) => UUID.test(x)))].slice(0, MAX);
  const supabase = await createClient();

  const { data } = ids.length
    ? await supabase.from('institutions').select('id, name, city, state, division, conference, sports_offered, website_url, price_calculator_url, athletics_url, international_url, cost_attendance_usd, tuition_out_of_state_usd, sat_avg, admission_rate, data_source, source_fetched_at').in('id', ids)
    : { data: [] };
  const insts = ids.map((id) => (data as Inst[] | null)?.find((i) => i.id === id)).filter(Boolean) as Inst[];
  if (insts.length >= 2) await logEvent('universities_compared', { count: insts.length });

  const q = (sp.q ?? '').replace(/[%_,()]/g, '').slice(0, 60);
  const { data: results } = q.length >= 2 && ids.length < MAX
    ? await supabase.from('institutions').select('id, name, state, division').ilike('name', `%${q}%`).order('name').limit(8)
    : { data: [] };

  const passport = session.roles.includes('athlete') ? await loadPassport(session.userId) : null;
  const fits = insts.map((i) => (passport?.profile ? institutionFit(passport.profile, passport.annualBudgetUsd, i) : null));
  const costs = insts.map((i) => i.cost_attendance_usd).filter((c): c is number => c != null);
  const cheapest = costs.length ? Math.min(...costs) : null;

  const rows: { label: string; cell: (i: Inst, n: number) => React.ReactNode }[] = [
    { label: 'Ubicación', cell: (i) => [i.city, i.state].filter(Boolean).join(', ') || '—' },
    { label: 'División', cell: (i) => (i.division ? DIVISION_LABEL[i.division] : 'Sin dato') + (i.conference ? ` · ${i.conference}` : '') },
    { label: 'Coste anual oficial (sin beca)', cell: (i) => <span className={i.cost_attendance_usd != null && i.cost_attendance_usd === cheapest ? 'text-ok' : ''}>{usd(i.cost_attendance_usd)}</span> },
    { label: 'Matrícula fuera del estado', cell: (i) => usd(i.tuition_out_of_state_usd) },
    { label: 'SAT medio de admitidos', cell: (i) => i.sat_avg ?? 'Sin dato' },
    { label: 'Tasa de admisión', cell: (i) => (i.admission_rate != null ? `${Math.round(i.admission_rate * 100)} %` : 'Sin dato') },
    ...(passport?.profile
      ? [{ label: 'Tu encaje', cell: (_i: Inst, n: number) => {
          const f = fits[n];
          return f ? <div><Badge tone={f.level === 'alto' ? 'ok' : f.level === 'bajo' ? 'danger' : 'neutral'}>{f.level}</Badge><ul className="mt-1 space-y-0.5 text-xs">{f.reasons.map((r) => <li key={r.label} className={r.ok === null ? 'text-faint' : r.ok ? 'text-ok' : 'text-danger'}>{r.ok === null ? '?' : r.ok ? '✓' : '✗'} {r.label}</li>)}</ul></div> : '—';
        } }]
      : []),
    { label: 'Enlaces oficiales', cell: (i) => (
      <ul className="space-y-0.5 text-xs">
        {[['Web', i.website_url], ['Calculadora de precio neto', i.price_calculator_url], ['Deportes', i.athletics_url], ['Estudiantes internacionales', i.international_url]]
          .filter(([, u]) => u).map(([l, u]) => <li key={l}><a href={u!} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{l} ({domainOf(u)}) ↗</a></li>)}
      </ul>
    ) },
    { label: 'Fuente de los datos', cell: (i) => <span className="text-xs text-faint">{i.data_source === 'college_scorecard' ? 'College Scorecard (U.S. Dept. of Education)' : i.data_source === 'manual_admin' ? 'Revisión del equipo' : 'Sin fuente'}{i.source_fetched_at ? ` · ${i.source_fetched_at.slice(0, 10)}` : ''}</span> },
  ];

  return (
    <>
      <PageHeader kicker="Universidades" title="Comparador" description={`Hasta ${MAX} universidades lado a lado con datos oficiales. El coste es sin beca: compáralo con la ayuda que figure por escrito en cada oferta.`} />
      <Card className="mb-5">
        <form method="get" className="flex flex-wrap gap-2">
          {ids.length > 0 && <input type="hidden" name="ids" value={ids.join(',')} />}
          <input name="q" defaultValue={q} placeholder={ids.length >= MAX ? 'Máximo alcanzado' : 'Añadir universidad por nombre'} disabled={ids.length >= MAX} aria-label="Buscar universidad" className={`${inputClass} max-w-sm`} />
          <button className="rounded-lg bg-brass px-4 text-sm font-medium text-ink" disabled={ids.length >= MAX}>Buscar</button>
        </form>
        {(results ?? []).length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {(results ?? []).filter((r) => !ids.includes(r.id)).map((r) => (
              <li key={r.id}><Link href={href([...ids, r.id])} className="inline-block rounded-full border border-line px-3 py-1 text-sm text-paper hover:border-brass/60">+ {r.name}{r.state ? ` (${r.state})` : ''}</Link></li>
            ))}
          </ul>
        )}
      </Card>

      {insts.length === 0 ? (
        <EmptyState title="Añade universidades para compararlas">Busca por nombre arriba o usa «Añadir al comparador» en la ficha de cada universidad.</EmptyState>
      ) : (
        <Card>
          <CardTitle kicker={`${insts.length} de ${MAX}`}>Comparación</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="w-44 py-2 text-left text-xs font-normal text-faint" scope="col"><span className="sr-only">Dato</span></th>
                  {insts.map((i) => (
                    <th key={i.id} scope="col" className="py-2 pr-4 text-left align-top font-normal">
                      <Link href={`/app/universities/${i.id}`} className="text-paper hover:text-brass">{i.name}</Link>
                      <Link href={href(ids.filter((x) => x !== i.id))} className="ml-2 text-xs text-faint hover:text-danger" aria-label={`Quitar ${i.name}`}>Quitar</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="py-3 pr-3 text-left align-top text-xs font-normal text-faint">{r.label}</th>
                    {insts.map((i, n) => <td key={i.id} className="py-3 pr-4 align-top tabular-nums text-paper">{r.cell(i, n)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-faint">El encaje es orientativo (deporte, división y presupuesto); no es probabilidad de admisión ni de beca.</p>
        </Card>
      )}
    </>
  );
}
