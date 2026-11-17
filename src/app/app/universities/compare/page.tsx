import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadAthleteContext } from '@/lib/data/gala-match';
import { galaMatch, estimatedIntlCost, STATE_NAME, usdFmt, type GalaMatch } from '@/lib/domain/gala-match/engine';
import { OWNERSHIP_LABEL } from '@/lib/domain/university';
import { ConfidenceBadge, MatchScore } from '@/components/match/MatchParts';
import { DIVISION_LABEL, domainOf, usd } from '@/lib/domain/labels';
import { logEvent } from '@/lib/events';
import type { Division } from '@/lib/types';
import { Card, CardTitle, EmptyState, PageHeader, inputClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Comparar universidades' };

const MAX = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Inst {
  id: string; name: string; city: string | null; state: string | null; division: Division | null; conference: string | null;
  sports_offered: string[]; website_url: string | null; price_calculator_url: string | null; athletics_url: string | null;
  international_url: string | null; cost_attendance_usd: number | null; tuition_out_of_state_usd: number | null;
  sat_avg: number | null; admission_rate: number | null; data_source: string | null; source_fetched_at: string | null;
  association: string | null; athletic_source: 'manual_admin' | 'organization' | 'official_external' | null; ownership: 'public' | 'private_nonprofit' | 'private_forprofit' | null;
  locale: 'city' | 'suburb' | 'town' | 'rural' | null; enrollment: number | null; tuition_in_state_usd: number | null; net_price_usd: number | null;
  graduation_rate: number | null; program_cips: string[];
}

const href = (ids: string[]) => `/app/universities/compare${ids.length ? `?ids=${ids.join(',')}` : ''}`;

export default async function CompareUniversitiesPage({ searchParams }: { searchParams: Promise<{ ids?: string; q?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const ids = [...new Set((sp.ids ?? '').split(',').filter((x) => UUID.test(x)))].slice(0, MAX);
  const supabase = await createClient();

  const { data } = ids.length
    ? await supabase.from('institutions').select('id, name, city, state, division, conference, sports_offered, website_url, price_calculator_url, athletics_url, international_url, cost_attendance_usd, tuition_out_of_state_usd, sat_avg, admission_rate, data_source, source_fetched_at, association, athletic_source, ownership, locale, enrollment, tuition_in_state_usd, net_price_usd, graduation_rate, program_cips').in('id', ids)
    : { data: [] };
  const insts = ids.map((id) => (data as Inst[] | null)?.find((i) => i.id === id)).filter(Boolean) as Inst[];
  if (insts.length >= 2) { await logEvent('universities_compared', { count: insts.length }); await logEvent('comparison_created', { count: insts.length }); }

  const q = (sp.q ?? '').replace(/[%_,()]/g, '').slice(0, 60);
  const { data: results } = q.length >= 2 && ids.length < MAX
    ? await supabase.from('institutions').select('id, name, state, division').ilike('name', `%${q}%`).order('name').limit(8)
    : { data: [] };

  const loaded = session.roles.includes('athlete') ? await loadAthleteContext(session.userId) : null;
  const matches: (GalaMatch | null)[] = insts.map((i) => (loaded ? galaMatch(loaded.ctx, { kind: 'institution', ...i, program_cips: i.program_cips ?? [] }) : null));
  const { data: activeRows } = ids.length ? await supabase.from('opportunities').select('organizations!inner(institution_id)').eq('status', 'published').in('organizations.institution_id', ids) : { data: [] };
  const activeBy = new Map<string, number>();
  for (const r of activeRows ?? []) { const k = (r.organizations as unknown as { institution_id: string }).institution_id; activeBy.set(k, (activeBy.get(k) ?? 0) + 1); }
  const costs = insts.map((i) => estimatedIntlCost(i)).filter((c): c is number => c != null);
  const cheapest = costs.length ? Math.min(...costs) : null;

  const rows: { label: string; cell: (i: Inst, n: number) => React.ReactNode }[] = [
    ...(loaded ? [{ label: 'Gala Match', cell: (_i: Inst, n: number) => { const m = matches[n]!; return <div className="flex items-center gap-2"><MatchScore m={m} size="sm" /><ConfidenceBadge m={m} /></div>; } }] : []),
    { label: 'Ubicación', cell: (i) => [i.city, STATE_NAME(i.state)].filter(Boolean).join(', ') || '—' },
    { label: 'Nivel deportivo', cell: (i) => [i.association?.toUpperCase(), i.division ? DIVISION_LABEL[i.division] : null, i.conference].filter(Boolean).join(' · ') || 'Sin confirmar' },
    { label: 'Oportunidades activas', cell: (i) => (activeBy.get(i.id) ? <span className="font-semibold text-ok">{activeBy.get(i.id)}</span> : <span className="text-faint">Ninguna verificada</span>) },
    ...(loaded ? [{ label: 'Tus estudios', cell: (_i: Inst, n: number) => { const f = matches[n]!.dimensions.flatMap((d) => d.factors).find((x) => x.id === 'program'); return f ? <span className="text-xs">{f.detail}</span> : '—'; } }] : []),
    { label: 'Coste publicado est. (internacional, sin becas)', cell: (i) => { const c = estimatedIntlCost(i); return <span className={c != null && c === cheapest ? 'text-ok' : ''}>{c != null ? usdFmt(c) : 'No publicado'}</span>; } },
    { label: 'Matrícula no residentes', cell: (i) => usd(i.tuition_out_of_state_usd) },
    { label: 'Precio neto medio publicado', cell: (i) => <span>{usd(i.net_price_usd)}<span className="block text-[11px] text-faint">Con ayuda federal de EE. UU.; no aplica a internacionales</span></span> },
    { label: 'Tipo', cell: (i) => (i.ownership ? OWNERSHIP_LABEL[i.ownership] : 'Sin dato') },
    { label: 'Estudiantes de grado', cell: (i) => (i.enrollment != null ? i.enrollment.toLocaleString('es-ES') : 'Sin dato') },
    { label: 'Tasa de graduación', cell: (i) => (i.graduation_rate != null ? `${Math.round(i.graduation_rate * 100)} %` : 'Sin dato') },
    { label: 'SAT medio de admitidos', cell: (i) => i.sat_avg ?? 'Sin dato' },
    { label: 'Tasa de admisión', cell: (i) => (i.admission_rate != null ? `${Math.round(i.admission_rate * 100)} %` : 'Sin dato') },
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
          <p className="mt-4 text-xs text-faint">Gala Match mide compatibilidad con tu Passport; no es probabilidad de admisión, beca ni oferta. Ninguna cifra resta becas no confirmadas.</p>
        </Card>
      )}
    </>
  );
}
