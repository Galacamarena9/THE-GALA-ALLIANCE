import Link from 'next/link';
import { ArrowRight, CalendarClock, Hourglass, Search, Sparkles, UserCheck } from 'lucide-react';
import type { SessionContext } from '@/lib/session';
import { loadPortfolio, type PortfolioData } from '@/lib/data/portfolio';
import { loadCatalog } from '@/lib/data/athlete';
import { Button, ButtonLink, Notice, inputClass } from '@/components/ui';
import { ActivityFeed, AthleteAvatar, KpiTile, NextStepsList, Panel, PanelLink, StatusPill } from '@/components/portfolio';
import { buildTimeline, initials, nextSteps, relativeTime, sortPortfolio } from '@/lib/domain/portfolio';

/**
 * Inicio del agente: todo sale de su cartera real (sin métricas inventadas).
 * Estructura inspirada en los mejores CRMs: resumen → cartera → qué ha pasado → qué toca hacer.
 */
export async function AgentHome({ session }: { session: SessionContext }) {
  const [data, catalog] = await Promise.all([loadPortfolio(session.userId), loadCatalog()]);
  return <AgentHomeView displayName={session.displayName} data={data} sports={catalog.sports} />;
}

export function AgentHomeView({ displayName, data, sports }: { displayName: string; data: PortfolioData; sports: { id: string; name_es: string }[] }) {
  const { agencies, entries, notes, stats } = data;
  const nameOf = new Map(entries.map((e) => [e.athleteId, e.name]));
  const featured = sortPortfolio(entries.filter((e) => e.status === 'active'), 'activity').slice(0, 3);
  const pending = sortPortfolio(entries.filter((e) => e.status === 'requested'), 'recent').slice(0, 4);
  const activity = buildTimeline(entries, notes, 7);
  const steps = nextSteps(notes, nameOf).slice(0, 5);
  const first = displayName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="bg-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="glow-gold pointer-events-none absolute -right-24 -top-24 h-80 w-80" aria-hidden />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brass">
              <Sparkles className="h-3 w-3" aria-hidden /> Agent Workspace
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-paper sm:text-[40px]">
              {greeting}, <span className="text-brass">{first}</span>
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {stats.active ? `Representas a ${stats.active} atleta${stats.active > 1 ? 's' : ''}` : 'Aún no representas a ningún atleta'}
              {stats.pending ? ` · ${stats.pending} propuesta${stats.pending > 1 ? 's' : ''} esperando respuesta` : ''}
              {stats.overdueFollowUps ? ` · ${stats.overdueFollowUps} seguimiento${stats.overdueFollowUps > 1 ? 's' : ''} vencido${stats.overdueFollowUps > 1 ? 's' : ''}` : ''}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/app/discover"><Search className="h-4 w-4" aria-hidden /> Explorar talento</ButtonLink>
              <ButtonLink href="/app/portfolio" variant="secondary">Ver portfolio <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
            </div>
          </div>
          {agencies[0] && (
            <Link href="/app/organization" className="flex items-center gap-3 self-start rounded-2xl border border-line bg-ink/50 px-4 py-3 transition-colors hover:border-brass/40 lg:self-auto">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass/15 font-display text-sm font-bold text-brass">{initials(agencies[0].name)}</span>
              <span>
                <span className="block text-sm font-semibold text-paper">{agencies[0].name}</span>
                <span className="block text-xs text-faint">{agencies[0].verification_status === 'verified' ? 'Agencia verificada ✓' : 'Pendiente de verificación'}</span>
              </span>
            </Link>
          )}
        </div>
      </section>

      {!agencies.length && (
        <Notice>Registra tu agencia para empezar a construir tu cartera: <Link href="/app/organization" className="font-semibold underline">crear agencia</Link>.</Notice>
      )}

      {/* KPIs reales y clicables */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Atletas representados" value={stats.active} icon={UserCheck} href="/app/portfolio?status=active" />
        <KpiTile label="Propuestas pendientes" value={stats.pending} icon={Hourglass} href="/app/portfolio?status=requested" hint={stats.pending ? 'Esperando al atleta' : undefined} />
        <KpiTile label="Nuevas en 30 días" value={stats.newLast30Days} icon={Sparkles} hint="Propuestas enviadas" />
        <KpiTile
          label="Seguimientos abiertos"
          value={stats.openFollowUps}
          icon={CalendarClock}
          hint={stats.overdueFollowUps ? `${stats.overdueFollowUps} vencido${stats.overdueFollowUps > 1 ? 's' : ''}` : stats.openFollowUps ? 'Al día' : undefined}
          hintTone={stats.overdueFollowUps ? 'danger' : 'ok'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Tu portfolio" action={<PanelLink href="/app/portfolio">Ver todo →</PanelLink>}>
            {!featured.length ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-muted">Cuando un atleta acepte tu propuesta aparecerá aquí.</p>
                <ButtonLink href="/app/discover" variant="secondary" className="mt-4">Buscar talento</ButtonLink>
              </div>
            ) : (
              <ul className="grid gap-3 p-1 sm:grid-cols-3">
                {featured.map((e) => (
                  <li key={e.repId}>
                    <Link href={`/app/portfolio/${e.athleteId}`} className="group block overflow-hidden rounded-2xl border border-line bg-ink/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brass/25 via-surface-2 to-ink">
                        {e.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- avatares de dominios variables
                          <img src={e.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold text-brass/80">{initials(e.name)}</span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/90 to-transparent" aria-hidden />
                      </div>
                      <div className="space-y-1 p-3.5">
                        <p className="truncate font-semibold text-paper group-hover:text-brass">{e.name}</p>
                        <p className="truncate text-xs text-muted">{[e.sportName, e.positionName, e.graduationYear].filter(Boolean).join(' · ') || 'Sin datos deportivos'}</p>
                        <StatusPill status={e.status} className="mt-1.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Propuestas pendientes" action={pending.length ? <PanelLink href="/app/portfolio?status=requested">Ver todas →</PanelLink> : undefined}>
            {!pending.length ? <p className="px-3 py-6 text-center text-sm text-muted">No hay propuestas esperando respuesta.</p> : (
              <ul className="space-y-0.5">
                {pending.map((e) => (
                  <li key={e.repId}>
                    <Link href={`/app/portfolio/${e.athleteId}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2/60">
                      <AthleteAvatar name={e.name} src={e.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-paper">{e.name}</span>
                        <span className="block truncate text-xs text-faint">Enviada {relativeTime(e.createdAt)}</span>
                      </span>
                      <StatusPill status={e.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Descubrir talento: atajo al escaparate con los filtros reales del directorio */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <h2 className="font-display text-[15px] font-bold text-paper">Descubrir talento</h2>
            <p className="mt-0.5 text-sm text-muted">Encuentra la próxima generación de atletas.</p>
            <form action="/app/discover" method="get" className="mt-4 grid gap-2 sm:grid-cols-[190px_140px_minmax(0,1fr)_auto]">
              <label><span className="sr-only">Deporte</span>
                <select name="sport" className={inputClass} defaultValue="">
                  <option value="">Cualquier deporte</option>
                  {sports.map((s) => <option key={s.id} value={s.id}>{s.name_es}</option>)}
                </select>
              </label>
              <label><span className="sr-only">Promoción</span>
                <select name="grad" className={inputClass} defaultValue="">
                  <option value="">Promoción</option>
                  {Array.from({ length: 6 }, (_, i) => year + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label><span className="sr-only">Nombre</span>
                <input name="q" placeholder="Buscar por nombre…" className={inputClass} maxLength={60} />
              </label>
              <Button type="submit"><Search className="h-4 w-4" aria-hidden /> Buscar</Button>
            </form>
          </section>
        </div>

        <div className="space-y-5">
          <Panel title="Actividad reciente">
            <ActivityFeed events={activity} empty="Aquí verás propuestas, respuestas y notas de tu agencia." />
          </Panel>
          <Panel title="Próximas acciones" action={<PanelLink href="/app/portfolio">Portfolio →</PanelLink>}>
            <NextStepsList steps={steps} empty="Sin seguimientos pendientes. Prográmalos desde la ficha de cada atleta." />
          </Panel>
        </div>
      </div>
    </div>
  );
}
