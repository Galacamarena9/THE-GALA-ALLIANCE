import Link from 'next/link';
import { SPORT_TONE_CLASS, sportTone } from '@/lib/domain/sport-tone';
import { ArrowRight, CalendarClock, Hourglass, Search, Sparkles, UserCheck } from 'lucide-react';
import type { SessionContext } from '@/lib/session';
import { loadPortfolio, type PortfolioData } from '@/lib/data/portfolio';
import { loadCatalog } from '@/lib/data/athlete';
import { ButtonLink, Notice, inputClass } from '@/components/ui';
import { ActivityFeed, AthleteAvatar, KpiTile, NextStepsList, Panel, PanelLink, StatusPill } from '@/components/portfolio';
import { buildTimeline, initials, nextSteps, relativeTime, sortPortfolio } from '@/lib/domain/portfolio';

/**
 * Inicio del agente: todo sale de su cartera real (sin métricas inventadas).
 * Estructura inspirada en los mejores CRMs: resumen → cartera → qué ha pasado → qué toca hacer.
 */
const SHORTCUTS = [
  { href: '/app/lists', title: 'Mis listas', text: 'Atletas que sigues y tus notas', img: '/media/club-training-sm.webp' },
  { href: '/app/opportunities', title: 'Oportunidades', text: 'Becas y ofertas publicadas', img: '/media/university-campus-sm.webp' },
  { href: '/app/organization', title: 'Mi agencia', text: 'Equipo, verificación y perfil', img: '/media/agent-workspace-sm.webp' },
];

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
      {/* Hero: bloque Noche de marca, con la acción principal en lima. */}
      <section className="rise-in relative overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- fondo decorativo local */}
        <img src="/media/arena-bg.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/30" aria-hidden />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="max-w-xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lavender backdrop-blur">
              <span className="live-dot" aria-hidden /> {stats.overdueFollowUps ? `${stats.overdueFollowUps} seguimiento${stats.overdueFollowUps > 1 ? 's' : ''} por ponerse al día` : 'Todo al día'}
            </p>
            <h1 className="font-display text-4xl font-bold uppercase leading-none text-white sm:text-[52px]">
              {greeting}, {first}
            </h1>
            <p className="mt-3 text-[15px] text-lavender">
              {stats.active ? `Representas a ${stats.active} atleta${stats.active > 1 ? 's' : ''}` : 'Aún no representas a ningún atleta'}
              {stats.pending ? `. ${stats.pending} propuesta${stats.pending > 1 ? 's' : ''} esperando respuesta` : ''}
              {stats.overdueFollowUps ? `. ${stats.overdueFollowUps} seguimiento${stats.overdueFollowUps > 1 ? 's' : ''} vencido${stats.overdueFollowUps > 1 ? 's' : ''}` : ''}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app/discover" className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-night transition-transform hover:-translate-y-0.5 focus-visible:outline-lime">
                <Search className="h-4 w-4" aria-hidden /> Explorar talento
              </Link>
              <Link href="/app/portfolio" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-lime">
                Ver portfolio <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
          {agencies[0] && (
            <Link href="/app/organization" className="flex items-center gap-3 self-start rounded-2xl border border-white/15 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus-visible:outline-lime lg:self-auto">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime font-display text-base font-bold text-night">{initials(agencies[0].name)}</span>
              <span>
                <span className="block text-sm font-semibold text-white">{agencies[0].name}</span>
                <span className="block text-xs text-lavender">{agencies[0].verification_status === 'verified' ? 'Agencia verificada ✓' : 'Pendiente de verificación'}</span>
              </span>
            </Link>
          )}
        </div>
      </section>

      {!agencies.length && (
        <Notice>Registra tu agencia para empezar a construir tu cartera: <Link href="/app/organization" className="font-semibold underline">crear agencia</Link>.</Notice>
      )}

      {/* KPIs reales y clicables */}
      <div className="rise-in rise-in-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="rise-in rise-in-2 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Tu portfolio" action={<PanelLink href="/app/portfolio">Ver todo →</PanelLink>}>
            {!featured.length ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-muted">Cuando un atleta acepte tu propuesta aparecerá aquí.</p>
                <ButtonLink href="/app/discover" variant="secondary" className="mt-4">Buscar talento</ButtonLink>
              </div>
            ) : (
              <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto p-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-1" aria-label="Atletas representados">
                {featured.map((e) => (
                  <li key={e.repId} className="w-[68%] shrink-0 snap-start sm:w-auto">
                    <Link href={`/app/portfolio/${e.athleteId}`} className="group block overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[var(--shadow-elevated)]">
                      <div className={`court-lines relative aspect-[4/3] overflow-hidden ${SPORT_TONE_CLASS[sportTone(e.sportName ?? e.sportId)]}`}>
                        {e.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- avatares de dominios variables
                          <img src={e.avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center font-display text-6xl font-bold text-white drop-shadow-sm transition-transform duration-500 group-hover:scale-110">{initials(e.name)}</span>
                        )}
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
                      <AthleteAvatar name={e.name} src={e.avatarUrl} sport={e.sportName ?? e.sportId} size="sm" />
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

          {/* Descubrir talento: tarjeta con foto (ilustrativa) y búsqueda real sobre el directorio */}
          <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen local optimizada */}
            <img src="/media/hero-athletes-sm.webp" alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
            <div className="tile-shade absolute inset-0" aria-hidden />
            <div className="relative p-5 pt-24 sm:p-6 sm:pt-32">
              <h2 className="font-display text-3xl font-bold uppercase leading-none">Descubrir talento</h2>
              <p className="mt-1 text-sm text-lavender">Encuentra la próxima generación de atletas.</p>
              <form action="/app/discover" method="get" className="mt-4 grid gap-2 sm:grid-cols-[180px_130px_minmax(0,1fr)_auto]">
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
                <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-bold text-night hover:-translate-y-0.5 transition-transform focus-visible:outline-lime"><Search className="h-4 w-4" aria-hidden /> Buscar</button>
              </form>
              <p className="mt-3 text-[11px] text-lavender/80">Imagen ilustrativa.</p>
            </div>
          </section>

          {/* Atajos con foto */}
          <ul className="grid gap-3 sm:grid-cols-3">
            {SHORTCUTS.map((c, i) => (
              <li key={c.href} className={`rise-in rise-in-${i + 1}`}>
                <Link href={c.href} className="hover-lift group relative block h-36 overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen local optimizada */}
                  <img src={c.img} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="tile-shade absolute inset-0" aria-hidden />
                  <span className="absolute inset-x-0 bottom-0 p-4">
                    <span className="block font-display text-xl font-bold uppercase leading-none">{c.title}</span>
                    <span className="mt-1 block text-xs text-lavender">{c.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
