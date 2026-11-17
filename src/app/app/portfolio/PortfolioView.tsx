import Link from 'next/link';
import { CalendarClock, ChevronRight, Hourglass, Search, UserCheck, Users, Video } from 'lucide-react';
import { ButtonLink, EmptyState, Notice, PageHeader, cx } from '@/components/ui';
import { AthleteAvatar, KpiTile, StatusPill } from '@/components/portfolio';
import { PortfolioFilterBar } from '@/components/portfolio-client';
import {
  filterPortfolio, filtersToQuery, gradOptions, lastActivityAt, relativeTime, sinceDate, sportOptions,
  statusCounts, type PortfolioEntry, type PortfolioFilters, type PortfolioStats, type StatusFilter,
} from '@/lib/domain/portfolio';

const TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Representados' },
  { id: 'requested', label: 'Pendientes' },
  { id: 'declined', label: 'Rechazadas' },
  { id: 'ended', label: 'Finalizadas' },
];

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

import type { MyOrg } from '@/lib/data/orgs';

export function PortfolioView({ agencies, entries, stats, filters }: { agencies: MyOrg[]; entries: PortfolioEntry[]; stats: PortfolioStats; filters: PortfolioFilters }) {
  const visible = filterPortfolio(entries, filters);
  const counts = statusCounts(entries);
  const multiAgency = agencies.length > 1;

  return (
    <>
      <PageHeader
        kicker="Agent Workspace"
        title="Cartera"
        description="Tus atletas representados y las propuestas en curso. Solo representas a quien lo acepta expresamente."
        action={<ButtonLink href="/app/discover"><Search className="h-4 w-4" aria-hidden /> Buscar talento</ButtonLink>}
      />

      {!agencies.length ? (
        <EmptyState title="Primero, crea tu agencia" action={<ButtonLink href="/app/organization">Registrar agencia</ButtonLink>}>
          La cartera pertenece a la agencia: así tu equipo comparte atletas, notas y seguimientos.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {agencies.some((a) => a.verification_status !== 'verified') && (
            <Notice>Tu agencia está pendiente de verificación: hasta entonces no puedes contactar atletas por la plataforma.</Notice>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Representados" value={stats.active} icon={UserCheck} href="/app/portfolio?status=active" />
            <KpiTile label="Propuestas pendientes" value={stats.pending} icon={Hourglass} href="/app/portfolio?status=requested" hint={stats.pending ? 'Esperando al atleta' : undefined} />
            <KpiTile
              label="Seguimientos abiertos"
              value={stats.openFollowUps}
              icon={CalendarClock}
              hint={stats.overdueFollowUps ? `${stats.overdueFollowUps} vencido${stats.overdueFollowUps > 1 ? 's' : ''}` : stats.openFollowUps ? 'Al día' : undefined}
              hintTone={stats.overdueFollowUps ? 'danger' : 'ok'}
            />
            <KpiTile label="Cerradas" value={stats.declined + stats.ended} icon={Users} hint={`${stats.declined} rechazada${stats.declined === 1 ? '' : 's'} · ${stats.ended} finalizada${stats.ended === 1 ? '' : 's'}`} />
          </div>

          <section className="rounded-[var(--radius-card)] border border-line bg-surface">
            <nav aria-label="Estado" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
              {TABS.map((t) => {
                const active = filters.status === t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/app/portfolio${filtersToQuery(filters, { status: t.id })}`}
                    aria-current={active ? 'page' : undefined}
                    scroll={false}
                    className={cx(
                      'relative flex shrink-0 items-center gap-2 rounded-t-lg px-3 pb-3 pt-1.5 text-sm transition-colors',
                      active ? 'font-semibold text-paper' : 'text-muted hover:text-paper',
                    )}
                  >
                    {t.label}
                    <span className={cx('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-brass text-ink' : 'bg-surface-2 text-faint')}>{counts[t.id]}</span>
                    {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brass" aria-hidden />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 sm:p-4">
              <PortfolioFilterBar filters={filters} sports={sportOptions(entries)} grads={gradOptions(entries)} />
            </div>

            {!entries.length ? (
              <div className="px-4 pb-6">
                <EmptyState title="Tu portfolio está vacío" action={<ButtonLink href="/app/discover">Ir al escaparate</ButtonLink>}>
                  Encuentra atletas en el escaparate y propónles representación desde su perfil. Aparecerán aquí en cuanto envíes la propuesta.
                </EmptyState>
              </div>
            ) : !visible.length ? (
              <div className="px-4 pb-8 pt-2 text-center">
                <p className="text-sm text-paper">Ningún atleta coincide con estos filtros.</p>
                <Link href="/app/portfolio" className="mt-1 inline-block text-sm font-medium text-brass hover:underline">Ver todo el portfolio</Link>
              </div>
            ) : (
              <>
                {/* Escritorio: tabla densa al estilo CRM */}
                <div className="hidden lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-line text-left text-xs font-bold uppercase tracking-[0.12em] text-faint">
                        <th scope="col" className="px-5 py-2.5">Atleta</th>
                        <th scope="col" className="px-3 py-2.5">Deporte · Posición</th>
                        <th scope="col" className="px-3 py-2.5">Promoción</th>
                        <th scope="col" className="px-3 py-2.5">Estado</th>
                        <th scope="col" className="px-3 py-2.5">Desde</th>
                        <th scope="col" className="px-3 py-2.5">Última actividad</th>
                        <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Abrir</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((e) => (
                        <tr key={e.repId} className="group relative border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2/60">
                          <td className="px-5 py-3">
                            <Link href={`/app/portfolio/${e.athleteId}`} className="flex items-center gap-3 after:absolute after:inset-0 focus-visible:outline-none">
                              <AthleteAvatar name={e.name} src={e.avatarUrl} sport={e.sportName ?? e.sportId} />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-paper group-hover:text-brass">{e.name}</span>
                                <span className="block truncate text-xs text-faint">
                                  {[e.currentTeam, e.country].filter(Boolean).join(' · ') || '—'}
                                  {multiAgency && ` · ${e.agencyName}`}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-muted">
                            <span className="inline-flex items-center gap-1.5">
                              {[e.sportName, e.positionName].filter(Boolean).join(' · ') || '—'}
                              {e.hasVideo && <Video className="h-3.5 w-3.5 text-brass" aria-label="Tiene vídeo" />}
                            </span>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted">{e.graduationYear ?? '—'}</td>
                          <td className="px-3 py-3"><StatusPill status={e.status} /></td>
                          <td className="px-3 py-3 text-muted">{dateFmt(sinceDate(e))}</td>
                          <td className="px-3 py-3 text-muted">{relativeTime(lastActivityAt(e))}</td>
                          <td className="px-3 py-3"><ChevronRight className="h-4 w-4 text-faint group-hover:text-brass" aria-hidden /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Móvil y tableta: tarjetas */}
                <ul className="grid grid-cols-1 gap-2 p-3 pt-0 sm:grid-cols-2 lg:hidden">
                  {visible.map((e) => (
                    <li key={e.repId} className="min-w-0">
                      <Link href={`/app/portfolio/${e.athleteId}`} className="flex items-center gap-3 rounded-2xl border border-line bg-ink/40 p-3 transition-colors hover:border-brass/40">
                        <AthleteAvatar name={e.name} src={e.avatarUrl} sport={e.sportName ?? e.sportId} size="lg" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-paper">{e.name}</span>
                          <span className="block truncate text-xs text-muted">{[e.sportName, e.positionName, e.graduationYear].filter(Boolean).join(' · ') || 'Sin datos deportivos'}</span>
                          <span className="mt-1.5 flex min-w-0 items-center gap-2">
                            <StatusPill status={e.status} />
                            <span className="truncate text-xs text-faint">{relativeTime(lastActivityAt(e))}</span>
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line px-5 py-3 text-xs text-faint">{visible.length} de {entries.length}</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
