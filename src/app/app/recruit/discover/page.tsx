import { getT } from '@/lib/i18n/server-t';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import { currentRecruitOrg, discoverAthletes, PAGE_SIZE, type DiscoverFilters } from '@/lib/data/recruit';
import type { NeedCriteria } from '@/lib/domain/recruit';
import { ISO_COUNTRIES } from '@/lib/domain/passport';
import { logEvent } from '@/lib/events';
import { Card, EmptyState, Notice, PageHeader, inputClass } from '@/components/ui';
import { RecruitShell } from '@/components/recruit/RecruitShell';
import { AddToShortlist } from '@/components/recruit/RecruitForms';
import { QuickViewButton, QuickViewProvider, ScrollMemory } from '@/components/recruit/QuickView';
import { addCandidate } from '@/app/actions/recruit';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('Descubrir atletas') };
}

type SP = { org?: string; need?: string; sport?: string; position?: string; grad?: string; country?: string; h?: string; video?: string; acad?: string; vstats?: string; q?: string; page?: string };
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

  const f: DiscoverFilters = {
    sport: sp.sport || undefined, position: /^\d+$/.test(sp.position ?? '') ? Number(sp.position) : undefined,
    grad: /^\d{4}$/.test(sp.grad ?? '') ? Number(sp.grad) : undefined, country: sp.country || undefined,
    minHeight: /^\d{3}$/.test(sp.h ?? '') ? Number(sp.h) : undefined, video: sp.video === '1', academics: sp.acad === '1', verifiedStats: sp.vstats === '1',
    q: sp.q || undefined, page: Math.max(1, Number(sp.page) || 1),
  };
  let result: Awaited<ReturnType<typeof discoverAthletes>> | null = null;
  let failed = false;
  if (canDiscover) {
    try { result = await discoverAthletes(f, need ?? null, org?.id); } catch { failed = true; }
    if (result && f.page === 1) {
      void logEvent('athlete_discovered', { filters: Object.values(f).filter(Boolean).length, need: !!need });
      if (/Mobi|Android/i.test((await headers()).get('user-agent') ?? '')) void logEvent('mobile_discovery_search', { filters: Object.values(f).filter(Boolean).length });
    }
  }
  const sport = f.sport ?? need?.sport_id;
  const positions = catalog.positions.filter((p) => !sport || p.sport_id === sport);
  const posName = new Map(catalog.positions.map((p) => [p.id, p.name_es]));
  const qs = (patch: Partial<SP>) => {
    const next = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/app/recruit/discover?${next.toString()}`;
  };
  const chips = [
    sp.sport && { k: 'sport', label: catalog.sports.find((s) => s.id === sp.sport)?.name_es ?? sp.sport },
    sp.position && { k: 'position', label: posName.get(Number(sp.position)) ?? tx('Posición') },
    sp.grad && { k: 'grad', label: `${tx('Clase')} ${sp.grad}` },
    sp.country && { k: 'country', label: sp.country },
    sp.h && { k: 'h', label: `≥ ${(Number(sp.h) / 100).toFixed(2)} m` },
    sp.video && { k: 'video', label: tx('Con vídeo') },
    sp.acad && { k: 'acad', label: tx('Académico documentado') },
    sp.vstats && { k: 'vstats', label: tx('Estadísticas verificadas') },
  ].filter(Boolean) as { k: keyof SP; label: string }[];
  const rows = need && result ? [...result.rows].sort((a, b) => Number(b.fit?.blocked === false) - Number(a.fit?.blocked === false)) : result?.rows ?? [];
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

            <form method="get" className="space-y-3">
              {sp.org && <input type="hidden" name="org" value={sp.org} />}
              {need && <input type="hidden" name="need" value={need.id} />}
              <label htmlFor="dq" className="sr-only">{tx('Buscar por nombre')}</label>
              <input id="dq" name="q" defaultValue={sp.q} placeholder={tx('Nombre…')} className={inputClass} />
              <details className="rounded-2xl border border-line bg-surface p-3" open={!chips.length}>
                <summary className="cursor-pointer text-sm font-semibold text-paper">Filtros{chips.length ? ` (${chips.length})` : ''}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {!need && <label className="text-xs text-muted">{tx('Deporte')}<select name="sport" defaultValue={sp.sport ?? ''} className={inputClass}><option value="">{tx('Todos')}</option>{catalog.sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}</select></label>}
                  <label className="text-xs text-muted">{tx('Posición')}{sport ? '' : ` (${tx('elige deporte')})`}<select name="position" defaultValue={sp.position ?? ''} disabled={!sport} className={inputClass}><option value="">{tx('Todas')}</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.name_es}</option>)}</select></label>
                  <label className="text-xs text-muted">{tx('Clase')}<select name="grad" defaultValue={sp.grad ?? ''} className={inputClass}><option value="">{tx('Todas')}</option>{Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
                  <label className="text-xs text-muted">{tx('País')}<select name="country" defaultValue={sp.country ?? ''} className={inputClass}><option value="">{tx('Todos')}</option>{ISO_COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
                  <label className="text-xs text-muted">{tx('Altura mínima (cm)')}<input name="h" type="number" min={140} max={230} defaultValue={sp.h} className={inputClass} /></label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-paper"><input type="checkbox" name="video" value="1" defaultChecked={sp.video === '1'} className="h-4 w-4" />{tx('Con vídeo')}</label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-paper"><input type="checkbox" name="acad" value="1" defaultChecked={sp.acad === '1'} className="h-4 w-4" />{tx('Académico documentado')}</label>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-paper"><input type="checkbox" name="vstats" value="1" defaultChecked={sp.vstats === '1'} className="h-4 w-4" />{tx('Estadísticas verificadas')}</label>
                </div>
                <div className="sticky bottom-0 mt-3 flex items-center gap-3 bg-surface py-2">
                  <button className="min-h-11 flex-1 rounded-full bg-brass px-5 text-sm font-semibold text-ink sm:flex-none">{tx('Aplicar filtros')}</button>
                  <Link href={qs({ sport: undefined, position: undefined, grad: undefined, country: undefined, h: undefined, video: undefined, acad: undefined, vstats: undefined, q: undefined })} className="text-sm text-muted underline">{tx('Borrar todo')}</Link>
                </div>
              </details>
            </form>

            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-sm font-semibold text-paper">{result ? tx(`${result.total} atleta${result.total === 1 ? '' : 's'}`) : '—'}</span>
              {chips.map((c) => <Link key={c.k} href={qs({ [c.k]: undefined })} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-3 text-xs text-brass" aria-label={`Quitar filtro ${c.label}`}>{c.label} ×</Link>)}
            </div>
            {need && <p className="text-xs text-muted">El % es compatibilidad con los criterios de «{need.title}», no una valoración del talento. Los datos que el atleta no comparte no penalizan: bajan la confianza.</p>}

            {failed ? <Notice tone="danger">{tx('No se ha podido cargar la búsqueda.')}{' '}<Link href={qs({})} className="underline">{tx('Reintentar')}</Link></Notice>
          : result?.needsSport ? <EmptyState title={tx('Elige un deporte para buscar')}>{tx('Para proteger a los atletas, Discovery no lista toda la base: empieza por un deporte (o una necesidad de recruiting).')}</EmptyState>
          : !rows.length ? <EmptyState title={tx('Sin resultados')}>{tx('Prueba a quitar algún filtro. Solo aparecen atletas abiertos a oportunidades que comparten su perfil contigo.')}</EmptyState>
            : (
              <QuickViewProvider org={org.id} lists={listOpts} members={org.caps.has('tasks') ? members : []} rows={rows.map((r) => ({
                user_id: r.user_id, display_name: r.display_name, avatar_url: r.avatar_url, height_cm: r.height_cm, has_video: r.has_video, verified_stats: r.verified_stats, fit: r.fit,
                meta: [r.primary_position_id && posName.get(r.primary_position_id), r.graduation_year && `${tx('Clase')} ${r.graduation_year}`, r.country].filter(Boolean).join(' · '),
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
                          <p className="text-xs text-muted">{[r.primary_position_id && posName.get(r.primary_position_id), r.graduation_year && `${tx('Clase')} ${r.graduation_year}`, r.country].filter(Boolean).join(' · ') || tx('Datos deportivos no compartidos')}</p>
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-paper">
                            {r.height_cm && <span>{(r.height_cm / 100).toFixed(2)} m</span>}
                            <span>{r.has_video ? tx('Vídeo ✓') : tx('Sin vídeo visible')}</span>
                            {r.academics_documented != null && <span>{r.academics_documented ? tx('Académico documentado') : tx('Académico declarado')}</span>}
                            {r.verified_stats ? <span>{tx('Estadísticas verificadas ✓')}</span> : null}
                          </p>
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
                <span className="text-muted">Página {f.page} de {totalPages}</span>
                {f.page < totalPages && <Link href={qs({ page: String(f.page + 1) })} className="text-brass">{tx('Siguiente →')}</Link>}
              </nav>
            )}
          </div>
        )}
      </RecruitShell>
    </>
  );
}
