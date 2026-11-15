import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, Bookmark, Search, Trash2 } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { loadCatalog } from '@/lib/data/athlete';
import type { DirectoryRow } from '@/components/AthleteCard';
import { AthleteAvatar } from '@/components/portfolio';
import { Badge, ButtonLink, EmptyState, PageHeader, cx, inputClass } from '@/components/ui';
import { copyToList, removeSavedAthlete, updateSavedNote } from '@/app/actions/lists';
import { deleteSearch, markSearchSeen } from '@/app/actions/growth';
import { countNewMatches, filtersToQuery, type DirectoryFilters } from '@/lib/data/directory';
import { chunk, listSummary, parseListView, sortSaved, type ListSort } from '@/lib/domain/lists';
import { SPORT_TONE_CLASS, sportTone } from '@/lib/domain/sport-tone';

export const metadata: Metadata = { title: 'Mis listas' };

const SORT_LABEL: Record<ListSort, string> = { recent: 'Añadidos recientemente', name: 'Nombre', grad: 'Promoción' };

function href(list: string | null, extra: Record<string, string | null> = {}) {
  const q = new URLSearchParams();
  if (list) q.set('list', list);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return `/app/lists${s ? `?${s}` : ''}`;
}

export default async function ListsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession(['university', 'coach', 'agent', 'brand']);
  const supabase = await createClient();
  const [catalog, savedRes, searchesRes] = await Promise.all([
    loadCatalog(),
    supabase
      .from('saved_athletes')
      .select('athlete_id, list_name, private_note, created_at')
      .eq('owner_id', session.userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('saved_searches')
      .select('id, label, filters, alerts_enabled, last_seen_at')
      .eq('owner_id', session.userId)
      .order('created_at', { ascending: false }),
  ]);
  const saved = savedRes.data ?? [];

  // Perfiles visibles para este usuario (la vista ya aplica privacidad y protección de menores). Por lotes: sin límite de URL.
  const ids = [...new Set(saved.map((s) => s.athlete_id))];
  const parts = await Promise.all(chunk(ids, 200).map((part) => supabase.from('athlete_directory').select('*').in('user_id', part)));
  const byId = new Map(parts.flatMap((r) => (r.data ?? []) as DirectoryRow[]).map((d) => [d.user_id, d]));

  const lists = listSummary(saved);
  const view = parseListView(await searchParams, lists.map((l) => l.name));
  const sportName = (id: string | null) => catalog.sports.find((x) => x.id === id)?.name_es ?? null;
  const positionName = (id: number | null) => catalog.positions.find((p) => p.id === id)?.name_es ?? null;

  const inList = saved
    .filter((s) => s.list_name === view.list)
    .map((s) => {
      const a = byId.get(s.athlete_id);
      return { ...s, a, name: a?.display_name ?? null, grad: a?.graduation_year ?? null, sport: a?.sport_id ?? null };
    });
  const sportsInList = [...new Set(inList.map((r) => r.sport).filter((x): x is string => !!x))];
  const rows = sortSaved(view.sport ? inList.filter((r) => r.sport === view.sport) : inList, view.sort);
  const otherLists = lists.map((l) => l.name).filter((n) => n !== view.list);

  const searches = await Promise.all(
    (searchesRes.data ?? []).map(async (s) => ({ ...s, fresh: s.alerts_enabled ? await countNewMatches(supabase, s.filters as DirectoryFilters, s.last_seen_at) : 0 })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Scouting"
        title="Mis listas"
        description="Privadas: nadie más ve a quién sigues ni tus notas."
        action={<ButtonLink href="/app/discover"><Search className="h-4 w-4" aria-hidden /> Buscar talento</ButtonLink>}
      />

      {!saved.length ? (
        <EmptyState title="Aún no sigues a ningún atleta" action={<ButtonLink href="/app/discover">Descubrir atletas</ButtonLink>}>
          Guarda atletas desde el buscador para seguirlos, ordenarlos en listas y añadir notas privadas.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Listas */}
          <nav aria-label="Tus listas" className="space-y-1">
            {lists.map((l) => {
              const on = l.name === view.list;
              return (
                <Link
                  key={l.name}
                  href={href(l.name)}
                  aria-current={on ? 'page' : undefined}
                  className={cx('flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors', on ? 'bg-brass/10 font-semibold text-brass' : 'text-muted hover:bg-surface hover:text-paper')}
                >
                  <span className="flex min-w-0 items-center gap-2"><Bookmark className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{l.name}</span></span>
                  <span className={cx('rounded-full px-2 text-xs tabular-nums', on ? 'bg-brass text-ink' : 'bg-surface-2 text-muted')}>{l.count}</span>
                </Link>
              );
            })}
            <p className="px-3 pt-2 text-xs leading-relaxed text-faint">Para crear una lista, copia a un atleta a un nombre nuevo desde su tarjeta.</p>
          </nav>

          <section aria-labelledby="list-title" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="list-title" className="font-display text-3xl font-bold uppercase text-paper">{view.list}</h2>
                <p className="text-sm text-muted">{rows.length} de {inList.length} atleta{inList.length === 1 ? '' : 's'}</p>
              </div>
              <form method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="list" value={view.list ?? ''} />
                {sportsInList.length > 1 && (
                  <label className="text-xs text-muted">
                    <span className="sr-only">Deporte</span>
                    <select name="sport" defaultValue={view.sport ?? ''} className={cx(inputClass, 'h-9 w-auto py-0')}>
                      <option value="">Todos los deportes</option>
                      {sportsInList.map((s) => <option key={s} value={s}>{sportName(s) ?? s}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs text-muted">
                  <span className="sr-only">Ordenar</span>
                  <select name="sort" defaultValue={view.sort} className={cx(inputClass, 'h-9 w-auto py-0')}>
                    {(Object.keys(SORT_LABEL) as ListSort[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
                  </select>
                </label>
                <button className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-paper hover:border-brass/50">Aplicar</button>
              </form>
            </div>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => {
                const a = r.a;
                if (!a) {
                  return (
                    <li key={r.athlete_id} className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-5 text-sm text-muted">
                      Este perfil ya no está disponible: el atleta cambió su visibilidad o cerró su cuenta.
                      <form action={removeSavedAthlete} className="mt-3">
                        <input type="hidden" name="athlete_id" value={r.athlete_id} />
                        <input type="hidden" name="list_name" value={r.list_name} />
                        <button className="text-xs font-medium text-danger hover:underline">Quitar de la lista</button>
                      </form>
                    </li>
                  );
                }
                const sport = sportName(a.sport_id);
                return (
                  <li key={r.athlete_id} className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
                    <div className={cx('h-1.5', SPORT_TONE_CLASS[sportTone(sport ?? a.sport_id)])} aria-hidden />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start gap-3">
                        <AthleteAvatar name={a.display_name ?? 'Atleta'} src={null} sport={sport ?? a.sport_id} />
                        <div className="min-w-0">
                          <Link href={`/athletes/${a.user_id}`} className="block truncate font-semibold text-paper hover:text-brass">{a.display_name ?? 'Atleta'}</Link>
                          <p className="truncate text-xs text-muted">{[sport, positionName(a.primary_position_id), a.graduation_year && `Promoción ${a.graduation_year}`].filter(Boolean).join(', ')}</p>
                        </div>
                      </div>
                      {a.headline && <p className="mt-3 line-clamp-2 text-sm text-muted">{a.headline}</p>}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {a.has_video && <Badge tone="brass">Vídeo</Badge>}
                        {a.open_to_opportunities && <Badge tone="ok">Abierto a ofertas</Badge>}
                        {a.height_cm && <Badge>{a.height_cm} cm</Badge>}
                      </div>

                      <form action={updateSavedNote} className="mt-4 space-y-2">
                        <input type="hidden" name="athlete_id" value={r.athlete_id} />
                        <input type="hidden" name="list_name" value={r.list_name} />
                        <label className="block text-xs font-medium text-muted" htmlFor={`note-${r.athlete_id}`}>Nota privada</label>
                        <textarea id={`note-${r.athlete_id}`} name="private_note" rows={2} maxLength={2000} defaultValue={r.private_note ?? ''} placeholder="Qué te gustó, a quién se lo propondrías…" className={cx(inputClass, 'resize-y')} />
                        <button className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-paper hover:border-brass/50">Guardar nota</button>
                      </form>

                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <form action={copyToList} className="flex min-w-0 flex-1 gap-2">
                          <input type="hidden" name="athlete_id" value={r.athlete_id} />
                          <label className="sr-only" htmlFor={`copy-${r.athlete_id}`}>Copiar a otra lista</label>
                          <input id={`copy-${r.athlete_id}`} name="target" list={`lists-${r.athlete_id}`} required maxLength={80} placeholder="Copiar a lista…" className={cx(inputClass, 'h-8 min-w-0 py-0 text-xs')} />
                          <datalist id={`lists-${r.athlete_id}`}>{otherLists.map((n) => <option key={n} value={n} />)}</datalist>
                          <button className="rounded-lg bg-brass px-3 text-xs font-semibold text-ink hover:bg-brass-soft">Copiar</button>
                        </form>
                        <form action={removeSavedAthlete}>
                          <input type="hidden" name="athlete_id" value={r.athlete_id} />
                          <input type="hidden" name="list_name" value={r.list_name} />
                          <button className="rounded-lg p-1.5 text-faint hover:bg-danger/10 hover:text-danger" aria-label={`Quitar a ${a.display_name ?? 'este atleta'} de ${r.list_name}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <section aria-labelledby="searches-title" className="rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Bell className="h-4 w-4 text-brass" aria-hidden />
          <h2 id="searches-title" className="font-display text-xl font-bold uppercase text-paper">Búsquedas guardadas</h2>
        </div>
        {searches.length ? (
          <ul className="divide-y divide-line">
            {searches.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Link href={`/app/discover?${filtersToQuery(s.filters as DirectoryFilters)}`} className="font-medium text-paper hover:text-brass">{s.label}</Link>
                {s.fresh > 0 ? <Badge tone="brass">{s.fresh} nuevo{s.fresh === 1 ? '' : 's'} o actualizado{s.fresh === 1 ? '' : 's'}</Badge> : <Badge>Sin novedades</Badge>}
                <span className="ml-auto flex gap-3 text-xs">
                  {s.fresh > 0 && <form action={markSearchSeen}><input type="hidden" name="id" value={s.id} /><button className="text-muted hover:text-paper">Marcar como vistos</button></form>}
                  <form action={deleteSearch}><input type="hidden" name="id" value={s.id} /><button className="text-faint hover:text-danger">Eliminar</button></form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">Aplica filtros en el buscador y pulsa «Guardar búsqueda»: aquí te avisaremos de los perfiles nuevos que encajan (solo los que tienes permiso para ver).</p>
        )}
      </section>
    </div>
  );
}
