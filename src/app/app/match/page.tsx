import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Scale, Sparkles } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { loadAthleteContext, loadInstitutionMatches, loadOpportunityMatches, loadSaved, type MatchFilters, type ScoredOpportunity } from '@/lib/data/gala-match';
import { usdFmt } from '@/lib/domain/gala-match/engine';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { ConfidenceBadge, DimensionChips, HideButton, MatchScore, SaveButton } from '@/components/match/MatchParts';
import { InstitutionCard } from '@/components/match/InstitutionCard';
import { EmptyState, Notice, PageHeader, cx, inputClass, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'Gala Match' };

type SP = { tab?: string; division?: string; state?: string; size?: string; cost?: string; min?: string; conf?: string; program?: string; q?: string; n?: string };

const TABS = [['universidades', 'Universidades'], ['oportunidades', 'Oportunidades activas'], ['guardadas', 'Guardadas']] as const;

export default async function MatchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession(['athlete']);
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? 'universidades';
  const loaded = await loadAthleteContext(session.userId);
  if (!loaded) return <Notice tone="warn">Completa tu Passport para empezar a recibir matches.</Notice>;
  const { ctx } = loaded;
  const qs = (patch: Partial<SP>) => `?${new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]).toString()}`;

  return (
    <>
      <PageHeader kicker="Gala Match" title="Lo que más encaja contigo" description="Ordenado por compatibilidad con tu Passport, con las razones. Una universidad del directorio no implica que tenga una beca abierta: las oportunidades reales van aparte." />
      {!ctx.sport_id && <Notice tone="warn">Indica tu deporte en tu <Link href="/app/athlete/passport?s=identidad" className="underline">Passport</Link> para ver tus matches.</Notice>}

      <nav aria-label="Tipo de resultado" className="mb-5 flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 text-sm sm:w-fit">
        {TABS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={cx('whitespace-nowrap rounded-full px-4 py-2', tab === k ? 'bg-paper text-ink' : 'text-muted hover:text-paper')}>{l}</Link>)}
      </nav>

      {tab === 'universidades' && <Universities userId={session.userId} ctx={ctx} sp={sp} qs={qs} />}
      {tab === 'oportunidades' && <Opportunities userId={session.userId} ctx={ctx} />}
      {tab === 'guardadas' && <Saved userId={session.userId} />}
    </>
  );
}

async function Universities({ userId, ctx, sp, qs }: { userId: string; ctx: NonNullable<Awaited<ReturnType<typeof loadAthleteContext>>>['ctx']; sp: SP; qs: (p: Partial<SP>) => string }) {
  const f: MatchFilters = {
    division: sp.division && sp.division in DIVISION_LABEL ? sp.division : undefined,
    state: sp.state?.toUpperCase(), size: sp.size, q: sp.q,
    maxCost: sp.cost ? Number(sp.cost) || undefined : undefined,
    minScore: sp.min ? Number(sp.min) || undefined : undefined,
    confidence: sp.conf, program: sp.program,
  };
  let result: Awaited<ReturnType<typeof loadInstitutionMatches>>;
  try { result = await loadInstitutionMatches(userId, ctx, f); }
  catch { return <Notice tone="warn">Ahora mismo no podemos cargar tus matches. Vuelve a intentarlo en unos minutos.</Notice>; }
  const limit = Math.min(Number(sp.n) || 30, 300);
  const shown = result.scored.slice(0, limit);
  const lowConf = shown.length > 0 && shown.filter((x) => x.m.confidence === 'low').length > shown.length / 2;

  return (
    <>
      <form method="get" className="mb-5 grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-7">
        <input type="hidden" name="tab" value="universidades" />
        <input name="q" defaultValue={sp.q} placeholder="Buscar universidad" aria-label="Buscar universidad" className={`${inputClass} lg:col-span-2`} />
        <select name="division" defaultValue={sp.division ?? ''} aria-label="División" className={inputClass}><option value="">Todas las divisiones</option>{Object.entries(DIVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="state" defaultValue={sp.state} placeholder="Estado (FL)" maxLength={2} aria-label="Estado (código de dos letras)" className={`${inputClass} uppercase`} />
        <select name="size" defaultValue={sp.size ?? ''} aria-label="Tamaño" className={inputClass}><option value="">Cualquier tamaño</option><option value="small">Pequeña</option><option value="medium">Mediana</option><option value="large">Grande</option></select>
        <select name="cost" defaultValue={sp.cost ?? ''} aria-label="Coste publicado máximo" className={inputClass}><option value="">Cualquier coste</option>{[20000, 35000, 50000, 70000].map((c) => <option key={c} value={c}>Hasta {usdFmt(c)}</option>)}</select>
        <select name="min" defaultValue={sp.min ?? ''} aria-label="Encaje mínimo" className={inputClass}><option value="">Cualquier encaje</option>{[60, 75, 90].map((c) => <option key={c} value={c}>{c}% o más</option>)}</select>
        <select name="conf" defaultValue={sp.conf ?? ''} aria-label="Confianza" className={inputClass}><option value="">Cualquier confianza</option><option value="high">Confianza alta</option><option value="medium">Confianza media</option></select>
        <label className="flex items-center gap-2 px-2 text-sm text-paper"><input type="checkbox" name="program" value="1" defaultChecked={Boolean(sp.program)} className="h-4 w-4 accent-[var(--color-brass)]" />Con mis estudios</label>
        <button className={buttonClass('primary', 'md')}>Aplicar</button>
      </form>

      {lowConf && (
        <Notice tone="warn">La mayoría de estos encajes tienen <strong>confianza baja</strong> porque faltan datos en tu Passport. <Link href="/app/athlete/passport?s=objetivos" className="underline">Completa tus objetivos</Link> para afinarlos.</Notice>
      )}

      {result.totalInDirectory === 0 ? (
        <EmptyState title="Aún no hay universidades con tu deporte confirmado">
          Estamos incorporando el catálogo oficial de universidades de EE. UU. y confirmando sus programas deportivos uno a uno. No mostramos fichas inventadas. Mientras tanto, completa tu Passport: tus matches serán más precisos en cuanto lleguen. <Link href="/app/athlete/passport" className="text-brass hover:underline">Ir a mi Passport</Link>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Ningún resultado con estos filtros">Prueba a quitar algún filtro. {result.hiddenCount > 0 && `Tienes ${result.hiddenCount} oculta(s).`}</EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{result.scored.length} universidades · ordenadas por encaje{result.hiddenCount > 0 && ` · ${result.hiddenCount} oculta(s)`}</p>
          <ul className="grid gap-3 lg:grid-cols-2">{shown.map((x) => <li key={x.inst.id}><InstitutionCard x={x} /></li>)}</ul>
          {result.scored.length > limit && <div className="mt-6 text-center"><Link href={qs({ n: String(limit + 30) })} className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-6 text-sm text-paper hover:border-brass">Ver más</Link></div>}
        </>
      )}
    </>
  );
}

async function Opportunities({ userId, ctx }: { userId: string; ctx: NonNullable<Awaited<ReturnType<typeof loadAthleteContext>>>['ctx'] }) {
  let scored: ScoredOpportunity[];
  try { scored = (await loadOpportunityMatches(userId, ctx)).scored; }
  catch { return <Notice tone="warn">Ahora mismo no podemos cargar las oportunidades. Vuelve a intentarlo en unos minutos.</Notice>; }
  if (!scored.length) {
    return (
      <EmptyState title="No hay oportunidades verificadas activas ahora mismo">
        Solo mostramos becas y plazas publicadas por organizaciones verificadas. Seguiremos comparando tu Passport con cada nueva oportunidad. Mientras tanto, guarda universidades para seguir sus novedades.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {scored.map(({ opp, m, saved }) => (
        <li key={opp.id}>
          <article className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-start gap-4">
              <MatchScore m={m} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold uppercase leading-tight text-paper">{opp.title}</h2>
                <p className="text-sm text-muted">{opp.org_name}{opp.org_verified && ' · verificada'}{opp.division && ` · ${DIVISION_LABEL[opp.division as keyof typeof DIVISION_LABEL]}`}</p>
                <div className="mt-2 flex flex-wrap gap-2"><ConfidenceBadge m={m} />{opp.deadline && <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-paper">Plazo: {opp.deadline}</span>}</div>
              </div>
            </div>
            <DimensionChips m={m} />
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Link href={`/app/match/opportunity/${opp.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-paper px-4 text-sm font-semibold text-ink">Ver match<ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href={`/app/opportunities/${opp.id}`} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm text-muted hover:text-paper">Ver oportunidad</Link>
              <SaveButton kind="opportunity" id={opp.id} saved={saved} score={m.score} />
              <HideButton kind="opportunity" id={opp.id} score={m.score} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

async function Saved({ userId }: { userId: string }) {
  const saved = await loadSaved(userId);
  if (!saved.length) {
    return <EmptyState title="Aún no has guardado nada"><Sparkles className="mr-1 inline h-4 w-4 text-brass" aria-hidden />Guarda universidades y oportunidades desde tus matches para construir tu shortlist.</EmptyState>;
  }
  const instIds = saved.filter((s) => s.target_kind === 'institution').map((s) => s.target_id);
  return (
    <>
      {instIds.length > 1 && <Link href={`/app/universities/compare?ids=${instIds.slice(0, 5).join(',')}`} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brass px-5 text-sm font-semibold text-ink"><Scale className="h-4 w-4" aria-hidden />Comparar mis universidades guardadas</Link>}
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {saved.map((s) => (
          <li key={`${s.target_kind}:${s.target_id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="min-w-0"><span className="block font-semibold text-paper">{s.name}</span><span className="block text-xs text-muted">{s.target_kind === 'institution' ? 'Universidad' : 'Oportunidad'}{s.sub && ` · ${s.sub}`} · guardada el {new Date(s.created_at).toLocaleDateString('es-ES')}</span></span>
            <Link href={`/app/match/${s.target_kind}/${s.target_id}`} className="text-brass hover:underline">Ver match</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
