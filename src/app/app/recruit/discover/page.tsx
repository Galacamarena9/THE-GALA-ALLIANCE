import { getT } from '@/lib/i18n/server-t';
import { formatHeight } from '@/lib/i18n/format';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg, discoverAthletes, PAGE_SIZE, type DiscoverFilters } from '@/lib/data/recruit';
import type { NeedCriteria } from '@/lib/domain/recruit';
import { COUNTRY_NAME } from '@/lib/domain/passport';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { ENGLISH_LABEL, SORT_LABEL, activeFilterCount, parseSearch, termLabel, type DiscoverSort } from '@/lib/domain/recruit-search';
import { effectiveNcaaDivision, ncaaWindow, needsDivision } from '@/lib/domain/ncaa';
import { dateLocale } from '@/lib/i18n/t';
import { logEvent } from '@/lib/events';
import { Badge, Card, EmptyState, Notice, PageHeader } from '@/components/ui';
import { DiscoverFilters as FiltersForm } from '@/components/recruit/DiscoverFilters';
import { SaveOrgSearch } from '@/components/recruit/SaveOrgSearch';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { AddToShortlist } from '@/components/recruit/RecruitForms';
import { QuickViewButton, QuickViewProvider, ScrollMemory } from '@/components/recruit/QuickView';
import { addCandidate } from '@/app/actions/recruit';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Descubrir atletas') };
}

type SP = Record<string, string | undefined>;
const clean = (o: Record<string, string | undefined>) => Object.entries(o).filter((e): e is [string, string] => !!e[1]);
const CONF = { high: 'Confianza alta', medium: 'Confianza media', low: 'Confianza baja' } as const;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const tx = await getT();
  const session = await requireSession();
  const sp = await searchParams;
  const { orgs, org } = await currentRecruitOrg(session.userId, sp.org);
  const supabase = await createClient();
  const catalog = await loadCatalog(tx.locale);
  const canDiscover = org?.caps.has('discover') ?? false;

  const [{ data: needs }, { data: lists }, { data: staff }] = org ? await Promise.all([
    supabase.from('recruiting_needs').select('id, title, sport_id, position_ids, class_years, min_height_cm, requires_video, requires_documented_academics, countries').eq('organization_id', org.id).eq('status', 'active'),
    supabase.from('org_shortlists').select('id, name').eq('organization_id', org.id).is('archived_at', null).order('updated_at', { ascending: false }),
    supabase.from('organization_members').select('user_id, profiles(display_name)').eq('organization_id', org.id).limit(100),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const members = (staff ?? []).map((m) => ({ id: m.user_id as string, name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? tx('Miembro') }));
  const need = (needs ?? []).find((n) => n.id === sp.need) as (NeedCriteria & { id: string; title: string }) | undefined;

  const parsed = parseSearch(sp);
  // Con una necesidad, por defecto se ordena por encaje (compatibilidad con sus criterios, no talento).
  const sort: DiscoverSort = parsed.sort === 'fit' && !need ? 'recent' : parsed.sort ?? (need ? 'fit' : 'recent');
  const f: DiscoverFilters = { ...parsed, sort, page: Math.max(1, Number(sp.page) || 1) };
  let result: Awaited<ReturnType<typeof discoverAthletes>> | null = null;
  let failed = false;
  if (canDiscover) {
    try { result = await discoverAthletes(f, need ?? null, org?.id, need?.id ?? null); } catch { failed = true; }
    if (result && f.page === 1) {
      void logEvent('athlete_discovered', { filters: Object.values(f).filter(Boolean).length, need: !!need });
      if (/Mobi|Android/i.test((await headers()).get('user-agent') ?? '')) void logEvent('mobile_discovery_search', { filters: Object.values(f).filter(Boolean).length });
    }
  }
  const sport = f.sport ?? need?.sport_id;
  const positions = catalog.positions.filter((p) => !sport || p.sport_id === sport);
  const posName = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const qs = (patch: Partial<SP>) => {
    const next = new URLSearchParams(clean({ ...sp, page: undefined, ...patch }));
    return `/app/recruit/discover?${next.toString()}`;
  };
  const fmtDay = new Intl.DateTimeFormat(dateLocale(tx.locale), { day: 'numeric', month: 'short', year: 'numeric' });
  const chips = [
    f.sport && { k: 'sport', label: catalog.sports.find((s) => s.id === f.sport)?.name_es ?? f.sport },
    f.position && { k: 'position', label: posName.get(f.position) ?? tx('Posición') },
    f.grad && { k: 'grad', label: `${tx('Promoción')} ${f.grad}` },
    f.country && { k: 'country', label: COUNTRY_NAME[f.country] ?? f.country },
    f.min_height && { k: 'h', label: `≥ ${formatHeight(f.min_height, tx.locale)}` },
    f.video && { k: 'video', label: tx('Con vídeo') },
    f.academics && { k: 'acad', label: tx('Académico documentado') },
    f.verified_stats && { k: 'vstats', label: tx('Estadísticas verificadas') },
    f.min_gpa && { k: 'gpa', label: `GPA ≥ ${f.min_gpa}` },
    f.english && { k: 'eng', label: `${tx('Inglés')} ${tx(ENGLISH_LABEL[f.english])}` },
    f.english_test && { k: 'etest', label: tx('Con test de inglés') },
    f.division && { k: 'div', label: DIVISION_LABEL[f.division] },
    f.start && { k: 'start', label: `${tx('Incorporación')} ${termLabel(f.start)}` },
    f.open && { k: 'open', label: tx('Abierto a ofertas') },
    f.contactable && { k: 'ncaa', label: tx('Contacto NCAA abierto') },
  ].filter(Boolean) as { k: string; label: string }[];
  const isCollege = !!org && needsDivision(org.type);
  const division = org ? effectiveNcaaDivision(org.type, org.division) : null;
  const filterQuery = new URLSearchParams(clean({ ...sp, page: undefined, org: undefined, need: undefined })).toString();
  const rows = result?.rows ?? [];
  const totalPages = result ? Math.min(20, Math.max(1, Math.ceil(result.total / PAGE_SIZE))) : 1;
  const listOpts = (lists ?? []).map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <PageHeader kicker={tx('Recruiting')} title={tx('Descubrir atletas')} description={tx('Búsqueda sobre el Opportunity Passport respetando la privacidad de cada atleta: lo que no te ha permitido ver no aparece ni se puede filtrar.')} />
      <RecruitShell org={org} orgs={orgs} active="/app/recruit/discover">
        {org && !canDiscover ? (
          <Notice tone="warn">{org.verified ? tx('Tu rol no incluye descubrir atletas. Pide acceso a un administrador.') : tx('Podrás descubrir atletas cuando tu organización esté verificada.')}</Notice>
        ) : org && (
          <div className="space-y-4">
            {(needs ?? []).length > 0 && (
              <nav aria-label={tx('Buscar para una necesidad')} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">{tx('Buscando para:')}</span>
                <Link href={qs({ need: undefined })} className={`rounded-full border px-3 py-1.5 ${!need ? 'border-brass text-brass' : 'border-line text-muted'}`}>{tx('Búsqueda libre')}</Link>
                {(needs ?? []).map((n) => <Link key={n.id} href={qs({ need: n.id, sport: undefined })} className={`rounded-full border px-3 py-1.5 ${need?.id === n.id ? 'border-brass bg-brass/10 text-brass' : 'border-line text-muted'}`}>{n.title}</Link>)}
              </nav>
            )}

            <FiltersForm tx={tx} sp={sp} sports={catalog.sports.map((x) => ({ id: x.id, name: x.name_es }))} positions={positions.map((p) => ({ id: p.id, name: p.name_es }))}
              sport={sport} hasNeed={!!need} isCollege={isCollege} count={chips.length}
              clearHref={qs(Object.fromEntries(['sport', 'position', 'grad', 'country', 'h', 'video', 'acad', 'vstats', 'q', 'gpa', 'eng', 'etest', 'div', 'start', 'open', 'ncaa', 'sort'].map((k) => [k, undefined])))} />

            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-sm font-semibold text-paper">{result ? tx(`${result.total} atleta${result.total === 1 ? '' : 's'}`) : '—'}</span>
              {chips.map((c) => <Link key={c.k} href={qs({ [c.k]: undefined })} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-3 text-xs text-brass" aria-label={`${tx('Quitar filtro')} ${c.label}`}>{c.label} ×</Link>)}
              {result && <span className="text-xs text-muted">· {tx('Orden:')} {tx(SORT_LABEL[sort])}</span>}
              {result && (f.sport || need) && activeFilterCount(f) + (need ? 1 : 0) > 0 && <span className="ml-auto"><SaveOrgSearch org={org.id} need={need?.id ?? null} query={filterQuery} /></span>}
            </div>
            {need && <p className="text-xs text-muted">{tx('El % es compatibilidad con los criterios de la necesidad, no una valoración del talento. Los datos que el atleta no comparte no penalizan: bajan la confianza.')}</p>}

            {failed ? <Notice tone="danger">{tx('No se ha podido cargar la búsqueda.')}{' '}<Link href={qs({})} className="underline">{tx('Reintentar')}</Link></Notice>
          : result?.needsSport ? <EmptyState title={tx('Elige un deporte para buscar')}>{tx('Para proteger a los atletas, Discovery no lista toda la base: empieza por un deporte (o una necesidad de recruiting).')}</EmptyState>
          : !rows.length ? <EmptyState title={tx('Sin resultados')}>{tx('Prueba a quitar algún filtro. Solo aparecen atletas abiertos a oportunidades que comparten su perfil contigo.')}</EmptyState>
            : (
              <QuickViewProvider org={org.id} lists={listOpts} members={org.caps.has('tasks') ? members : []} rows={rows.map((r) => ({
                user_id: r.user_id, display_name: r.display_name, avatar_url: r.avatar_url, height_cm: r.height_cm, has_video: r.has_video, verified_stats: r.verified_stats, fit: r.fit,
                meta: [r.primary_position_id && posName.get(r.primary_position_id), r.graduation_year && `${tx('Promoción')} ${r.graduation_year}`, r.country].filter(Boolean).join(' · '),
              }))}>
              <ScrollMemory storageKey={qs({})} />
              <ul className="grid gap-3 lg:grid-cols-2">
                {rows.map((r, i) => (
                  <li key={r.user_id}>
                    <Card className="h-full">
                      <div className="flex items-start gap-3">
                        {r.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar_url} alt="" loading="lazy" className="h-12 w-12 rounded-xl object-cover" />
                        ) : <span className="grid h-12 w-12 place-items-center rounded-xl bg-brass/15 font-display font-bold text-brass" aria-hidden>{r.display_name.slice(0, 1)}</span>}
                        <div className="min-w-0 flex-1">
                          <Link href={`/app/recruit/candidates/${r.user_id}`} className="font-display text-lg font-bold uppercase leading-tight text-paper hover:text-brass">{r.display_name}</Link>
                          <p className="text-xs text-muted">{[r.primary_position_id && posName.get(r.primary_position_id), r.graduation_year && `${tx('Promoción')} ${r.graduation_year}`, r.country].filter(Boolean).join(' · ') || tx('Datos deportivos no compartidos')}</p>
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-paper">
                            {r.height_cm && <span>{formatHeight(r.height_cm, tx.locale)}</span>}
                            <span>{r.has_video ? tx('Vídeo ✓') : tx('Sin vídeo visible')}</span>
                            {r.academics_documented != null && <span>{r.academics_documented ? tx('Académico documentado') : tx('Académico declarado')}</span>}
                            {r.verified_stats ? <span>{tx('Estadísticas verificadas ✓')}</span> : null}
                          </p>
                          {isCollege && (() => {
                            const w = ncaaWindow(r.graduation_year, division, r.sport_id);
                            return <p className="mt-1">{w.open ? <Badge tone="ok">{tx('Contacto disponible')}</Badge> : <Badge tone="warn">{tx('Contacto desde')} {fmtDay.format(new Date(`${w.opensOn}T12:00:00Z`))}</Badge>}</p>;
                          })()}
                        </div>
                        {r.fit && (
                          <div className="text-right">
                            <p className="font-display text-xl font-bold text-paper">{r.fit.blocked ? '—' : r.fit.score != null ? `${r.fit.score}%` : 's/d'}</p>
                            <p className="text-[10px] text-muted">{r.fit.blocked ? tx('No cumple un requisito') : tx(CONF[r.fit.confidence])}</p>
                          </div>
                        )}
                      </div>
                      {r.fit && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-brass">{tx('¿Por qué?')}</summary>
                          <ul className="mt-2 space-y-1">
                            {r.fit.met.map((x) => <li key={x.key} className="text-ok">✓ {tx(x.label)}</li>)}
                            {r.fit.unmet.map((x) => <li key={x.key} className="text-danger">✕ {tx(x.label)}{x.hard ? ` (${tx('requisito')})` : ''}</li>)}
                            {r.fit.missing.map((x) => <li key={x.key} className="text-warn">⚠ {tx(x.label)}: {tx('no disponible')}</li>)}
                          </ul>
                        </details>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <QuickViewButton index={i} label={r.display_name} />
                        <AddToShortlist athlete={r.user_id} lists={listOpts} fit={r.fit?.score ?? null} />
                        <Link href={`/app/recruit/candidates/${r.user_id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-paper hover:border-brass">{tx('Ver ficha')}</Link>
                        {org.caps.has('pipeline') && <form action={addCandidate}><input type="hidden" name="org" value={org.id} /><input type="hidden" name="athlete" value={r.user_id} /><button className="min-h-11 px-2 text-xs text-muted hover:text-paper">{tx('Añadir al pipeline')}</button></form>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              </QuickViewProvider>
            )}
            {totalPages > 1 && (
              <nav aria-label={tx('Paginación')} className="flex items-center justify-center gap-4 text-sm">
                {f.page > 1 && <Link href={qs({ page: String(f.page - 1) })} className="text-brass">{tx('← Anterior')}</Link>}
                <span className="text-muted">{tx('Página')} {f.page} / {totalPages}</span>
                {f.page < totalPages && <Link href={qs({ page: String(f.page + 1) })} className="text-brass">{tx('Siguiente →')}</Link>}
              </nav>
            )}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
