import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2, Eye, Sparkles } from 'lucide-react';
import { Badge, ButtonLink, Card, CardTitle } from '@/components/ui';
import { InstitutionCard } from '@/components/match/InstitutionCard';
import { MatchScore } from '@/components/match/MatchParts';
import { setTaskState } from '@/app/actions/dashboard';
import { describeConfidence } from '@/lib/domain/gala-match/changes';
import type { MatchChangeItem } from '@/lib/data/dashboard';
import { daysUntil, PRIORITY_LABEL, STAGE_LABEL, type ActionItem } from '@/lib/domain/dashboard';
import type { AthleteDashboard } from '@/lib/data/dashboard';

const fmtDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const fmtShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const PRIORITY_TONE = { urgent: 'danger', important: 'brass', recommended: 'neutral' } as const;
const APP_STATUS: Record<string, string> = {
  applied: 'Enviada', reviewed: 'Revisada', contacted: 'Contactado', information_requested: 'Piden información', interview: 'Entrevista',
  tryout: 'Prueba', shortlist: 'En su shortlist', offer: 'Oferta', accepted: 'Aceptada', declined: 'Descartada', withdrawn: 'Retirada',
};

function Unavailable({ what }: { what: string }) {
  return (
    <p className="text-sm text-muted" role="status">
      No hemos podido cargar {what}. <Link href="/app" className="font-semibold text-brass underline underline-offset-2">Reintentar</Link>
    </p>
  );
}

function TaskRow({ a }: { a: ActionItem }) {
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={a.href} className="text-sm font-semibold text-paper hover:text-brass">{a.title}</Link>
          <p className="mt-0.5 text-xs text-muted">{a.reason}</p>
        </div>
        <Badge tone={PRIORITY_TONE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
      </div>
      <TaskControls a={a} />
    </li>
  );
}

function TaskControls({ a, compact = false }: { a: ActionItem; compact?: boolean }) {
  // Las tareas que dependen de un dato (completar el Passport) se resuelven solas; aquí solo se pueden posponer.
  const manual = a.group === 'recruiting';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-3'}`}>
      {manual && (
        <form action={setTaskState}>
          <input type="hidden" name="key" value={a.key} /><input type="hidden" name="action" value="done" /><input type="hidden" name="priority" value={a.priority} />
          <button className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-paper hover:border-brass hover:text-brass">Hecho</button>
        </form>
      )}
      <form action={setTaskState}>
        <input type="hidden" name="key" value={a.key} /><input type="hidden" name="action" value="snooze" />
        <button className="rounded-full px-2 py-1 text-xs text-muted hover:text-paper" aria-label={`Posponer 3 días: ${a.title}`}>Posponer 3 días</button>
      </form>
      {a.priority === 'recommended' && (
        <form action={setTaskState}>
          <input type="hidden" name="key" value={a.key} /><input type="hidden" name="action" value="dismiss" />
          <button className="rounded-full px-2 py-1 text-xs text-muted hover:text-paper" aria-label={`Descartar: ${a.title}`}>Descartar</button>
        </form>
      )}
    </div>
  );
}

export function AthleteCommandCenter({ d, firstName, isMinor }: { d: AthleteDashboard; firstName: string; isMinor: boolean }) {
  const nba = d.actions[0];
  const rest = d.actions.slice(1, 8);
  const r = d.passport.readiness;
  const profile = d.passport.profile;
  const stage = STAGE_LABEL[d.stage];
  const { matches, deadlines, shortlist, opportunities, views, linkViews, activity, applications, offers, changes } = d.modules;
  const activeApps = applications.filter((a) => !['declined', 'withdrawn'].includes(a.status));

  return (
    <div className="space-y-6">
      {/* 1. Saludo, etapa y NEXT BEST ACTION. */}
      <section aria-labelledby="cc-hello" className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-7">
                <div className="relative grid gap-6 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="eyebrow text-gold">Hoy · {stage.label}</p>
            <h1 id="cc-hello" className="mt-2 font-display text-4xl leading-[1.05] text-paper sm:text-5xl">Hola, {firstName}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">{stage.focus}</p>
            {nba ? (
              <div className="mt-5 rounded-2xl border border-brass/40 bg-brass/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-brass">Tu siguiente mejor acción</span>
                  <Badge tone={PRIORITY_TONE[nba.priority]}>{PRIORITY_LABEL[nba.priority]}</Badge>
                </div>
                <p className="mt-2 text-lg font-semibold text-paper">{nba.title}</p>
                <p className="mt-1 text-sm text-muted"><span className="font-semibold text-paper">Por qué:</span> {nba.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ButtonLink href={nba.href}>{nba.cta} <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
                  <TaskControls a={nba} compact />
                </div>
              </div>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-sm text-paper"><CheckCircle2 className="h-5 w-5 text-brass" aria-hidden /> Estás al día. Cuando haya algo que hacer, aparecerá aquí.</p>
            )}
          </div>
          {/* Passport snapshot: tarjeta oscura de marca, con texto claro y contraste AA. */}
          <div className="passport p-5">
            <div className="flex items-center gap-3">
              {d.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo} alt="" className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-lime font-display text-xl font-bold text-night">{firstName.slice(0, 1)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{profile?.username ? `@${profile.username}` : 'Tu Passport'}</p>
                <p className="text-xs text-white/70">{isMinor ? 'Perfil privado por defecto (menor)' : 'Tú decides quién ve cada bloque'}</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-xs text-white/70"><span>Recruiting Readiness</span><span className="font-display text-2xl font-bold text-white">{r.score}<span className="text-sm text-white/60">/100</span></span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={r.score} aria-valuemin={0} aria-valuemax={100} aria-label="Recruiting Readiness">
                <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(2, Math.min(100, r.score))}%` }} />
              </div>
            </div>
            {r.score < 100 && r.plan[0] && (
              <p className="mt-3 text-xs text-white/75">Siguiente mejora: <span className="font-semibold text-white">{r.plan[0].action}</span></p>
            )}
            <div className="mt-4 hidden grid-cols-2 gap-2 text-center sm:grid">
              <div className="rounded-xl bg-white/[0.06] p-2.5">
                <p className="font-display text-2xl font-bold text-white">{views ? views.total : '—'}</p>
                <p className="text-[11px] text-white/70">Visitas al Passport</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-2.5">
                <p className="font-display text-2xl font-bold text-white">{linkViews ?? '—'}</p>
                <p className="text-[11px] text-white/70">Aperturas de tu enlace (7 d)</p>
              </div>
            </div>
            {views && views.organizations.length > 0 && (
              <p className="mt-3 text-xs text-white/75"><Eye className="mr-1 inline h-3.5 w-3.5" aria-hidden />Te vieron: {views.organizations.slice(0, 2).join(', ')}{views.organizations.length > 2 ? ` y ${views.organizations.length - 2} más` : ''}.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/app/athlete/passport" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-lime px-3 text-sm font-semibold text-night hover:brightness-105">Editar</Link>
              <Link href="/app/athlete/passport/preview" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/25 px-3 text-sm font-semibold text-white hover:bg-white/10">Ver como otros</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* 2. Matches nuevos (solo si su objetivo incluye universidad en EE. UU.). */}
          {d.seeksUSCollege ? (
            <Card>
              <CardTitle kicker="Gala Match" action={<Link href="/app/match" className="text-sm font-semibold text-brass">Ver todos</Link>}>
                {matches.ok && matches.data.unseenCount > 0 ? `${matches.data.unseenCount} match${matches.data.unseenCount > 1 ? 'es' : ''} sin revisar` : 'Tus mejores encajes'}
              </CardTitle>
              {!matches.ok ? <Unavailable what="tus matches" /> : matches.data.directoryEmpty ? (
                <p className="text-sm text-muted">El directorio de universidades se está cargando con datos oficiales. Mientras tanto, completa tu Passport: el encaje será más preciso.</p>
              ) : (matches.data.unseen.length ? matches.data.unseen : matches.data.top).length ? (
                <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {(matches.data.unseen.length ? matches.data.unseen : matches.data.top).slice(0, 3).map((x) => <li key={x.inst.id}><InstitutionCard x={x} showHide={false} /></li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted">Aún no hay datos suficientes para calcular tu encaje. Añade deporte, nivel académico y objetivos en tu Passport.</p>
              )}
              {changes.length > 0 && <MatchChanges items={changes} />}
            </Card>
          ) : (
            <Card>
              <CardTitle kicker="Tus objetivos">Fuera de la universidad en EE. UU.</CardTitle>
              <p className="text-sm text-muted">Tus objetivos no incluyen college en EE. UU., así que no te mostramos matches universitarios. Revisa oportunidades de clubes y pruebas, o cambia tus objetivos si quieres ver universidades.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href="/app/opportunities" variant="secondary">Oportunidades</ButtonLink>
                <ButtonLink href="/app/athlete/passport?s=goals" variant="secondary">Cambiar objetivos</ButtonLink>
              </div>
            </Card>
          )}

          {/* 3. Plazos: oficiales y recomendados, siempre separados. */}
          <Card>
            <CardTitle kicker="Calendario">Próximos plazos</CardTitle>
            {deadlines.data.length ? (
              <ul className="divide-y divide-line">
                {deadlines.data.map((x) => {
                  const n = daysUntil(x.date);
                  return (
                    <li key={x.id} className="flex items-start gap-3 py-2.5">
                      <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${x.kind === 'official' ? 'text-brass' : 'text-faint'}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link href={x.href} className="text-sm font-medium text-paper hover:text-brass">{x.title}</Link>
                        <p className="text-xs text-muted">{x.label}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-paper">{fmtDate.format(new Date(`${x.date}T12:00:00`))}</p>
                        <p className={`text-xs ${(x.kind === 'official' && n <= 3) || n < 0 ? 'font-semibold text-danger' : 'text-faint'}`}>{n < 0 ? 'Vencido' : n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No tienes plazos oficiales próximos. Cuando guardes una oportunidad con fecha límite o te presentes a una, aparecerá aquí (y te avisaremos 7 días y 1 día antes).</p>
            )}
          </Card>

          {/* 4. Tareas priorizadas. */}
          <Card>
            <CardTitle kicker="Plan" action={d.doneRecently > 0 ? <span className="text-xs text-muted">{d.doneRecently} hecha{d.doneRecently > 1 ? 's' : ''} en 14 días</span> : undefined}>Tus tareas</CardTitle>
            {rest.length ? (
              <>
                <ul className="space-y-3">
                  {rest.slice(0, 3).map((a) => <TaskRow key={a.key} a={a} />)}
                </ul>
                {rest.length > 3 && (
                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-brass">Ver {rest.length - 3} más <span className="group-open:hidden" aria-hidden>↓</span></summary>
                    <ul className="mt-3 space-y-3">{rest.slice(3).map((a) => <TaskRow key={a.key} a={a} />)}</ul>
                  </details>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">No hay más tareas pendientes.</p>
            )}
          </Card>

          {/* 5. Recorrido real. */}
          <Card>
            <CardTitle kicker="Tu recorrido">Del Passport a la decisión</CardTitle>
            <ol className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-7 lg:overflow-visible" aria-label="Etapas del recruiting">
              {d.journey.map((s, i) => (
                <li key={s.key} className="min-w-[84px] shrink-0 snap-start text-center lg:min-w-0" aria-current={s.current ? 'step' : undefined}>
                  <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${s.done ? 'border-brass bg-brass text-ink' : s.current ? 'border-brass text-brass ring-4 ring-brass/10' : 'border-line text-faint'}`}>
                    {s.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={`mt-1.5 block text-xs ${s.current ? 'font-semibold text-brass' : s.done ? 'text-muted' : 'text-faint'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Resumen">
          {/* Shortlist y oportunidades activas: dos cosas distintas. */}
          <Card>
            <CardTitle kicker="Shortlist" action={<Link href="/app/shortlist" className="text-sm font-semibold text-brass">Abrir</Link>}>{shortlist.ok ? `${shortlist.data.total} universidad${shortlist.data.total === 1 ? '' : 'es'} guardada${shortlist.data.total === 1 ? '' : 's'}` : 'Tu shortlist'}</CardTitle>
            {!shortlist.ok ? <Unavailable what="tu shortlist" /> : shortlist.data.items.length ? (
              <>
                <ul className="space-y-2">
                  {shortlist.data.items.map((s) => (
                    <li key={s.target_id} className="flex items-center justify-between gap-2">
                      <Link href={`/app/universities/${s.target_id}`} className="min-w-0 truncate text-sm text-paper hover:text-brass">{s.name}</Link>
                      {s.m ? <MatchScore m={s.m} size="sm" /> : null}
                    </li>
                  ))}
                </ul>
                {shortlist.data.withActive > 0 && <p className="mt-2 text-xs text-muted">{shortlist.data.withActive} con oportunidades abiertas ahora.</p>}
              </>
            ) : (
              <p className="text-sm text-muted">Guarda universidades desde Gala Match o el directorio para compararlas.</p>
            )}
          </Card>

          <Card>
            <CardTitle kicker="Oportunidades activas" action={<Link href="/app/match?tab=oportunidades" className="text-sm font-semibold text-brass">Ver</Link>}>Publicadas para tu perfil</CardTitle>
            {!opportunities.ok ? <Unavailable what="las oportunidades" /> : opportunities.data.length ? (
              <ul className="space-y-3">
                {opportunities.data.map((o) => (
                  <li key={o.opp.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/app/opportunities/${o.opp.id}`} className="block truncate text-sm font-medium text-paper hover:text-brass">{o.opp.title}</Link>
                      <p className="text-xs text-muted">{o.opp.org_name}{o.opp.deadline ? ` · cierra ${fmtShort.format(new Date(`${o.opp.deadline}T12:00:00`))}` : ''}</p>
                    </div>
                    <MatchScore m={o.m} size="sm" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Ahora mismo no hay oportunidades publicadas que encajen contigo. Solo mostramos las que publican organizaciones reales.</p>
            )}
          </Card>

          {(activeApps.length > 0 || offers.length > 0) && (
            <Card>
              <CardTitle kicker="Procesos" action={<Link href="/app/applications" className="text-sm font-semibold text-brass">Abrir</Link>}>Candidaturas y ofertas</CardTitle>
              <ul className="space-y-2 text-sm">
                {activeApps.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2"><span className="truncate text-paper">{a.title}</span><Badge>{APP_STATUS[a.status] ?? a.status}</Badge></li>
                ))}
                {offers.slice(0, 3).map((o) => (
                  <li key={o.id} className="flex justify-between gap-2"><Link href="/app/offers" className="truncate text-paper hover:text-brass">Oferta · {o.university_name}</Link><Badge tone={o.in_writing ? 'ok' : 'warn'}>{o.in_writing ? 'Por escrito' : 'Sin confirmar por escrito'}</Badge></li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle kicker="Actividad" action={<Link href="/app/notifications" className="text-sm font-semibold text-brass">Todo</Link>}>Reciente</CardTitle>
            {!activity.ok ? <Unavailable what="tu actividad" /> : activity.data.length ? (
              <ul className="space-y-2.5">
                {activity.data.slice(0, 4).map((n) => (
                  <li key={n.id} className="text-sm">
                    <Link href={n.link ?? '/app/notifications'} className="group block">
                      <span className={`block ${n.read_at ? 'text-muted' : 'font-medium text-paper'} group-hover:text-brass`}>{n.title}</span>
                      <span className="block text-xs text-faint">{fmtDate.format(new Date(n.created_at))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aquí verás respuestas, cambios de estado, plazos y visitas de organizaciones verificadas.</p>
            )}
          </Card>

          <p className="flex items-center gap-1.5 px-1 text-[11px] text-faint"><Sparkles className="h-3 w-3" aria-hidden /> Prioridades calculadas con reglas fijas y explicables, sin urgencias inventadas.</p>
        </aside>
      </div>
    </div>
  );
}

/** Cambios de encaje desde que se guardó: cifra, confianza y el porqué (solo si hay datos reales para explicarlo). */
function MatchChanges({ items }: { items: MatchChangeItem[] }) {
  return (
    <section aria-labelledby="match-changes" className="mt-4 border-t border-line pt-3">
      <h3 id="match-changes" className="text-xs font-semibold text-faint">Cambios desde que las guardaste</h3>
      <ul className="mt-2 space-y-3 text-sm">
        {items.slice(0, 3).map(({ id, name, href, change: c }) => {
          const up = c.from != null && c.to != null && c.to > c.from;
          const conf = describeConfidence(c);
          return (
            <li key={id}>
              <p>
                <Link href={href} className="font-semibold text-paper hover:text-brass">{name}</Link>{' '}
                {c.from != null && c.to != null && c.from !== c.to ? (
                  <span><span className="text-muted">{c.from}% → </span><span className={up ? 'font-semibold text-trust' : 'font-semibold text-paper'}>{c.to}%</span><span className="sr-only">{up ? ' (ha mejorado)' : ' (ha bajado)'}</span></span>
                ) : c.to == null ? <span className="text-muted">· sin porcentaje por ahora (faltan datos)</span> : null}
              </p>
              {conf && <p className="text-xs text-muted">{conf}</p>}
              {c.reasons.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {c.reasons.map((r) => <li key={r.factor}><span aria-hidden>{r.direction === 'up' ? '↑' : '↓'} </span>{r.text}</li>)}
                </ul>
              ) : c.methodChanged ? (
                <p className="mt-1 text-xs text-muted">Actualizamos el método de cálculo de Gala Match; ningún dato concreto explica el cambio.</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
