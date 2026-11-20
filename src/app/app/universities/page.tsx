import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { loadAthleteContext, loadInstitutionMatches, type MatchFilters } from '@/lib/data/gala-match';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { ASSOCIATION_LABEL, CIP_FAMILY } from '@/lib/domain/university';
import { STATE_NAME, estimatedIntlCost, usdFmt } from '@/lib/domain/gala-match/engine';
import { InstitutionCard } from '@/components/match/InstitutionCard';
import { RecentSearches } from '@/components/RecentSearches';
import { ButtonLink, EmptyState, Notice, PageHeader, inputClass, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Universidades' };

type SP = { q?: string; sport?: string; assoc?: string; division?: string; state?: string; size?: string; cost?: string; family?: string; active?: string; sort?: string; n?: string };

export default async function UniversitiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const catalog = await loadCatalog();
  const isAthlete = session.roles.includes('athlete');
  const loaded = isAthlete ? await loadAthleteContext(session.userId) : null;

  // Los filtros solo aparecen si hay datos que los respalden.
  const [{ count: total }, { count: withSize }, { count: withPrograms }, { count: withCost }] = await Promise.all([
    supabase.from('institutions').select('id', { count: 'exact', head: true }),
    supabase.from('institutions').select('id', { count: 'exact', head: true }).not('enrollment', 'is', null),
    supabase.from('institutions').select('id', { count: 'exact', head: true }).neq('program_cips', '{}'),
    supabase.from('institutions').select('id', { count: 'exact', head: true }).not('cost_attendance_usd', 'is', null),
  ]);
  const sportDefault = sp.sport ?? loaded?.ctx.sport_id ?? '';
  const f: MatchFilters = {
    q: sp.q, state: sp.state?.toUpperCase(), size: sp.size, family: sp.family && CIP_FAMILY[sp.family] ? sp.family : undefined,
    division: sp.division && sp.division in DIVISION_LABEL ? sp.division : undefined,
    association: sp.assoc && sp.assoc in ASSOCIATION_LABEL ? sp.assoc : undefined,
    maxCost: sp.cost ? Number(sp.cost) || undefined : undefined,
    activeOnly: sp.active === '1',
    sort: (['match', 'name', 'cost', 'enrollment'] as const).find((x) => x === sp.sort) ?? (loaded ? 'match' : 'name'),
    sport: sportDefault || undefined, allSports: !sportDefault,
  };
  const limit = Math.min(Number(sp.n) || 30, 300);
  const qs = (patch: Partial<SP>) => `?${new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString()}`;

  let content: React.ReactNode;
  if (!total) {
    content = (
      <EmptyState title="Estamos incorporando el catálogo oficial">
        Cargamos las universidades desde College Scorecard (U.S. Department of Education) y confirmamos sus programas deportivos uno a uno. No mostramos fichas inventadas.
      </EmptyState>
    );
  } else if (loaded) {
    let r: Awaited<ReturnType<typeof loadInstitutionMatches>> | null = null;
    try { r = await loadInstitutionMatches(session.userId, loaded.ctx, f); } catch { r = null; }
    content = !r ? <Notice tone="warn">Ahora mismo no podemos cargar el directorio. Vuelve a intentarlo en unos minutos.</Notice>
      : !r.scored.length ? <EmptyState title="Ninguna universidad con estos filtros">{sportDefault ? 'Aún hay pocas universidades con programas deportivos confirmados. Prueba con «Todos los deportes».' : 'Prueba a quitar algún filtro.'}</EmptyState>
      : (
        <>
          <p className="mb-3 text-sm text-muted">{r.scored.length} universidades{f.sort === 'match' ? ' · ordenadas por tu Gala Match' : ''}</p>
          <ul className="grid gap-3 lg:grid-cols-2">{r.scored.slice(0, limit).map((x) => <li key={x.inst.id}><InstitutionCard x={x} showHide={false} /></li>)}</ul>
          {r.scored.length > limit && <div className="mt-6 text-center"><Link href={qs({ n: String(limit + 30) })} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-6 text-sm text-paper hover:border-brass">Ver más</Link></div>}
        </>
      );
  } else {
    let q = supabase.from('institutions').select('id, name, city, state, division, cost_attendance_usd, tuition_in_state_usd, tuition_out_of_state_usd, ownership').order('name').limit(limit);
    if (f.q) q = q.ilike('name', `%${f.q.replace(/[%_,()]/g, '').slice(0, 60)}%`);
    if (f.division) q = q.eq('division', f.division);
    if (f.association) q = q.eq('association', f.association);
    if (f.state && /^[A-Z]{2}$/.test(f.state)) q = q.eq('state', f.state);
    if (f.sport) q = q.contains('sports_offered', [f.sport]);
    const { data } = await q;
    content = (data ?? []).length ? (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((u) => {
          const cost = estimatedIntlCost(u as Parameters<typeof estimatedIntlCost>[0]);
          return (
            <li key={u.id}>
              <Link href={`/app/universities/${u.id}`} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-brass/60">
                <span className="font-display text-lg font-bold uppercase leading-snug text-paper">{u.name}</span>
                <span className="text-xs text-muted">{[u.city, STATE_NAME(u.state)].filter(Boolean).join(', ')}{u.division && ` · ${DIVISION_LABEL[u.division as keyof typeof DIVISION_LABEL]}`}</span>
                <span className="mt-auto pt-4 text-xs text-faint">Coste publicado est.: <span className="text-paper">{cost != null ? `${usdFmt(cost)}/año` : 'No publicado'}</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
    ) : <EmptyState title="Ninguna universidad con estos filtros">Prueba a quitar algún filtro.</EmptyState>;
  }

  return (
    <>
      <PageHeader
        kicker="Universidades"
        title="Encuentra tu universidad"
        description="Datos institucionales oficiales (College Scorecard) y programas deportivos confirmados. Una universidad en el directorio no significa que tenga una beca abierta: las oportunidades activas se marcan aparte."
        action={<div className="flex flex-wrap gap-2">{isAthlete && <ButtonLink href="/app/shortlist" variant="secondary">Mi shortlist</ButtonLink>}<ButtonLink href="/app/universities/compare" variant="secondary">Comparar</ButtonLink></div>}
      />
      <form method="get" className="mb-3 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="Nombre de la universidad" aria-label="Buscar universidad por nombre" className={`${inputClass} sm:col-span-2`} />
        <select name="sport" defaultValue={sportDefault} aria-label="Deporte" className={inputClass}><option value="">Todos los deportes</option>{catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}</select>
        <select name="assoc" defaultValue={sp.assoc ?? ''} aria-label="Asociación" className={inputClass}><option value="">NCAA, NAIA, NJCAA…</option>{Object.entries(ASSOCIATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="division" defaultValue={sp.division ?? ''} aria-label="División" className={inputClass}><option value="">Todas las divisiones</option>{Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="state" defaultValue={sp.state} placeholder="Estado (FL)" maxLength={2} aria-label="Estado (código de dos letras)" className={`${inputClass} uppercase`} />
        {loaded && (withSize ?? 0) > 0 && <select name="size" defaultValue={sp.size ?? ''} aria-label="Tamaño" className={inputClass}><option value="">Cualquier tamaño</option><option value="small">Pequeña</option><option value="medium">Mediana</option><option value="large">Grande</option></select>}
        {loaded && (withCost ?? 0) > 0 && <select name="cost" defaultValue={sp.cost ?? ''} aria-label="Coste publicado máximo" className={inputClass}><option value="">Cualquier coste</option>{[20000, 35000, 50000, 70000].map((c) => <option key={c} value={c}>Hasta {usdFmt(c)}</option>)}</select>}
        {loaded && (withPrograms ?? 0) > 0 && <select name="family" defaultValue={sp.family ?? ''} aria-label="Área de estudios" className={inputClass}><option value="">Cualquier área de estudios</option>{Object.entries(CIP_FAMILY).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        {loaded && <select name="sort" defaultValue={f.sort} aria-label="Ordenar" className={inputClass}><option value="match">Mejor Gala Match</option><option value="name">Nombre</option>{(withCost ?? 0) > 0 && <option value="cost">Menor coste</option>}{(withSize ?? 0) > 0 && <option value="enrollment">Más estudiantes</option>}</select>}
        {loaded && <label className="flex items-center gap-2 px-2 text-sm text-paper"><input type="checkbox" name="active" value="1" defaultChecked={sp.active === '1'} className="h-4 w-4 accent-[var(--color-brass)]" />Con oportunidades activas</label>}
        <button className={buttonClass('primary', 'md')}>Buscar</button>
      </form>
      <RecentSearches current={sp.q} />
      {content}
    </>
  );
}
