import Link from 'next/link';
import { ArrowLeft, CalendarClock, Check, ExternalLink, MapPin, RotateCcw, StickyNote, Trash2, Video } from 'lucide-react';
import type { loadAthleteWorkspace } from '@/lib/data/portfolio';
import { deleteAgencyNote, toggleFollowUp } from '@/app/actions/portfolio';
import { ButtonLink, cx } from '@/components/ui';
import { ActivityFeed, AthleteAvatar, NextStepsList, Panel, StatusPill } from '@/components/portfolio';
import { EndRepresentationForm, NoteBody, NoteComposer } from '@/components/portfolio-client';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { buildTimeline, dueText, isOverdue, nextSteps, relativeTime, REP_PERMISSIONS, REP_TYPE_LABEL, repStatusDetail } from '@/lib/domain/portfolio';
import type { Division } from '@/lib/types';
import type { CaseRow } from '@/lib/data/agency-cases';
import { stageLabel, isCaseStale } from '@/lib/domain/agency-cases';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'notas', label: 'Notas' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'pasos', label: 'Próximos pasos' },
  { id: 'procesos', label: 'Procesos' },
] as const;
export type Tab = (typeof TABS)[number]['id'];
export const TAB_IDS = TABS.map((t) => t.id);

const SCHOOL_YEAR: Record<string, string> = { eso_3: '3.º ESO', eso_4: '4.º ESO', bach_1: '1.º Bachillerato', bach_2: '2.º Bachillerato', graduated: 'Graduado', college: 'Universidad' };
const SIDE: Record<string, string> = { left: 'Izquierda', right: 'Derecha', both: 'Ambas' };
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export type AthleteWorkspace = NonNullable<Awaited<ReturnType<typeof loadAthleteWorkspace>>>;

export function AthleteWorkspaceView({ ws, tab, userId, cases = [] }: { ws: AthleteWorkspace; tab: Tab; userId: string; cases?: CaseRow[] }) {
  const { current: e, history, notes, authorName, detail, scope, roster } = ws;
  const others = roster.filter((r) => r.athleteId !== e.athleteId);
  const ROLE_LABEL: Record<string, string> = { primary: 'Agente principal', secondary: 'Agente de apoyo', operations: 'Operaciones', collaborator: 'Colaborador', viewer: 'Solo lectura' };
  const daysLeft = scope.daysLeft;
  const statusNote = repStatusDetail(scope.dbStatus);
  const place = (v: string) => (v === 'WORLD' ? 'Todo el mundo' : v === 'EUROPE' ? 'Europa' : v === 'NORTH_AMERICA' ? 'Norteamérica' : v === 'LATAM' ? 'Latinoamérica' : v);
  const CAT: Record<string, string> = { university: 'Universidades', club: 'Clubes', academy: 'Academias', brand: 'Marcas' };
  const steps = nextSteps(notes, new Map([[e.athleteId, e.name]]));
  const timeline = buildTimeline(history, notes);
  const canNote = e.status !== 'declined';

  const sports: [string, string | null][] = [
    ['Deporte', e.sportName],
    ['Posición', e.positionName],
    ['Promoción', e.graduationYear ? String(e.graduationYear) : null],
    ['Equipo actual', e.currentTeam],
    ['Nivel competitivo', detail.competitiveLevel],
    ['Altura', detail.heightCm ? `${detail.heightCm} cm` : null],
    ['Lado dominante', detail.dominantSide ? SIDE[detail.dominantSide] ?? detail.dominantSide : null],
    ['Divisiones objetivo', detail.targetDivisions.length ? detail.targetDivisions.map((d) => DIVISION_LABEL[d as Division] ?? d).join(', ') : null],
  ];
  const academics: [string, string | null][] = [
    ['Curso', detail.schoolYear ? SCHOOL_YEAR[detail.schoolYear] ?? detail.schoolYear : null],
    ['Nota media', detail.gpa != null ? `${detail.gpa} / ${detail.gpaScale ?? 4}` : null],
    ['Inglés', detail.englishTest && detail.englishTest !== 'none' ? `${detail.englishTest.toUpperCase()}${detail.englishScore ? ` · ${detail.englishScore}` : ''}` : null],
    ['SAT', detail.sat ? String(detail.sat) : null],
    ['Carrera de interés', detail.intendedMajor],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Portfolio
        </Link>
        {others.length > 0 && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-line px-3 py-1.5 text-sm text-paper hover:border-brass/40">Cambiar de atleta ▾</summary>
            <ul className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-elevated)]">
              {others.map((o) => (
                <li key={o.athleteId}><Link href={`/app/portfolio/${o.athleteId}`} className="block truncate rounded-lg px-3 py-2 text-sm text-paper hover:bg-surface-2/60">{o.name}</Link></li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* «Actuando para»: evita confundir atletas al trabajar con varios a la vez. */}
      {scope.dbStatus === 'active' && scope.myRole && (
        <p className="sticky top-2 z-10 flex flex-wrap items-center gap-x-2 rounded-xl bg-night px-4 py-2 text-sm text-white shadow-[var(--shadow-elevated)]" role="status">
          <span className="text-xs font-semibold uppercase tracking-wide text-lime">Actuando para</span>
          <span className="font-semibold">{e.name}</span>
          <span className="text-lavender">· {ROLE_LABEL[scope.myRole] ?? scope.myRole}</span>
        </p>
      )}
      {scope.dbStatus === 'active' && !scope.myRole && (
        <p className="rounded-xl bg-warn/10 px-4 py-2 text-sm text-warn ring-1 ring-inset ring-warn/25">No estás asignado a este atleta: ves la ficha de la agencia, pero no puedes actuar en su nombre. Pide a quien dirige la agencia que te asigne.</p>
      )}

      {/* Cabecera tipo perfil (LinkedIn Recruiter): quién es, en qué estado está y la acción posible */}
      <header className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="relative h-24 bg-gradient-to-br from-brass/30 via-brass-deep/15 to-trust/20 sm:h-28">
          <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-start sm:gap-5 sm:px-6">
          <AthleteAvatar name={e.name} src={e.avatarUrl} sport={e.sportName ?? e.sportId} size="xl" className="-mt-10 h-24 w-24 border-4 border-surface shadow-[var(--shadow-elevated)] sm:-mt-12" />
          <div className="min-w-0 flex-1 sm:pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-bold text-paper sm:text-3xl">{e.name}</h1>
              <StatusPill status={e.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{[e.sportName, e.positionName, e.graduationYear ? `Promoción ${e.graduationYear}` : null].filter(Boolean).join(' · ') || 'Sin datos deportivos'}</p>
            {(detail.city || e.country) && <p className="mt-1 flex items-center gap-1 text-xs text-faint"><MapPin className="h-3.5 w-3.5" aria-hidden />{[detail.city, e.country].filter(Boolean).join(', ')}</p>}
            {detail.headline && <p className="mt-2 max-w-2xl text-sm text-paper/90">{detail.headline}</p>}
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:pt-4">
            <ButtonLink href={`/athletes/${e.athleteId}`} variant="secondary" className="px-3 py-2"><ExternalLink className="h-4 w-4" aria-hidden /> Perfil público</ButtonLink>
            {detail.videoUrl && <ButtonLink href={detail.videoUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className="px-3 py-2"><Video className="h-4 w-4" aria-hidden /> Vídeo</ButtonLink>}
            {(e.status === 'requested' || e.status === 'active') && (
              <EndRepresentationForm id={e.repId} agencyId={e.agencyId} athleteId={e.athleteId} from={e.status} />
            )}
          </div>
        </div>
        {e.status === 'requested' && (
          <p className="mx-5 mb-5 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/25 sm:mx-6">
            Propuesta enviada {relativeTime(e.createdAt)}. Solo el atleta puede aceptarla o rechazarla.
          </p>
        )}
      </header>

      <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const n = t.id === 'notas' ? notes.length : t.id === 'pasos' ? steps.length : null;
          return (
            <Link
              key={t.id}
              href={t.id === 'resumen' ? `/app/portfolio/${e.athleteId}` : `/app/portfolio/${e.athleteId}?tab=${t.id}`}
              scroll={false}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cx('relative shrink-0 px-3 pb-3 pt-1 text-sm transition-colors', tab === t.id ? 'font-semibold text-paper' : 'text-muted hover:text-paper')}
            >
              {t.label}
              {n != null && <span className="ml-1.5 text-xs tabular-nums text-faint">{n}</span>}
              {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brass" aria-hidden />}
            </Link>
          );
        })}
      </nav>

      {tab === 'resumen' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <FactsPanel title="Perfil deportivo" rows={sports} empty="El atleta aún no ha completado sus datos deportivos." />
            <FactsPanel title="Datos académicos" rows={academics} empty="No hay datos académicos visibles: el atleta decide quién los ve." />
            {detail.bio && <Panel title="Sobre el atleta"><p className="whitespace-pre-wrap px-2 py-1 text-sm leading-relaxed text-muted">{detail.bio}</p></Panel>}
          </div>
          <div className="space-y-5">
            <Panel title="Representación">
              <dl className="px-2 text-sm">
                <Row label="Estado"><StatusPill status={e.status} /></Row>
                {statusNote && <Row label="Detalle">{statusNote}</Row>}
                <Row label="Agencia">{e.agencyName}</Row>
                {scope.type && <Row label="Tipo">{REP_TYPE_LABEL[scope.type] ?? scope.type}</Row>}
                {scope.startDate && scope.endDate && <Row label="Vigencia">{dateFmt(scope.startDate)} → {dateFmt(scope.endDate)}</Row>}
                {daysLeft != null && daysLeft <= 30 && <Row label="Vence"><span className={daysLeft <= 7 ? 'text-danger' : 'text-warn'}>{daysLeft <= 0 ? 'Hoy' : `En ${daysLeft} días`}</span></Row>}
                {scope.sports.length > 0 && <Row label="Deporte">{scope.sports.join(', ')}</Row>}
                {scope.territories.length > 0 && <Row label="Territorio">{scope.territories.map(place).join(', ')}</Row>}
                {scope.categories.length > 0 && <Row label="Oportunidades">{scope.categories.map((c) => CAT[c] ?? c).join(', ')}</Row>}
                {scope.myRole && <Row label="Tu papel">{ROLE_LABEL[scope.myRole] ?? scope.myRole}</Row>}
                <Row label="Propuesta">{dateFmt(e.createdAt)}</Row>
                {e.respondedAt && <Row label={e.status === 'declined' ? 'Rechazada' : 'Aceptada'}>{dateFmt(e.respondedAt)}</Row>}
                {e.endedAt && <Row label="Finalizada">{dateFmt(e.endedAt)}</Row>}
                {history.length > 1 && <Row label="Historial">{history.length} propuestas</Row>}
              </dl>
              {e.message && <p className="mx-2 mb-2 mt-1 rounded-xl bg-ink/50 p-3 text-xs italic text-muted">“{e.message}”</p>}
              {scope.permissions.length > 0 && (
                <div className="mx-2 mb-2 mt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">El atleta te permite</p>
                  <ul className="space-y-0.5 text-xs text-muted">
                    {REP_PERMISSIONS.filter((p) => scope.permissions.includes(p.id)).map((p) => <li key={p.id} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{p.label}</li>)}
                  </ul>
                  <p className="mt-2 text-[11px] text-faint">Aceptar ofertas, el presupuesto familiar y las notas de la familia quedan siempre fuera.</p>
                </div>
              )}
            </Panel>
            <Panel title="Próximos pasos" action={<Link href={`/app/portfolio/${e.athleteId}?tab=pasos`} className="text-xs font-medium text-brass hover:underline">Ver todos</Link>}>
              <NextStepsList steps={steps.slice(0, 3)} showAthlete={false} />
            </Panel>
          </div>
        </div>
      )}

      {tab === 'notas' && (
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          {canNote ? <NoteComposer agencyId={e.agencyId} athleteId={e.athleteId} /> : (
            <p className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-5 text-sm text-muted">El atleta rechazó la propuesta: no se pueden añadir notas nuevas.</p>
          )}
          <Panel title="Historial de notas">
            {!notes.length ? <p className="px-3 py-10 text-center text-sm text-muted">Sin notas todavía. Lo que escribas aquí solo lo ve tu agencia.</p> : (
              <ul className="space-y-1">
                {notes.map((n) => {
                  const mine = n.author_id === userId;
                  const followUp = n.kind === 'follow_up';
                  const overdue = followUp && !n.done && isOverdue(n.due_date);
                  return (
                    <li key={n.id} className="group rounded-xl px-3 py-3 hover:bg-surface-2/50">
                      <div className="flex items-start gap-3">
                        <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', followUp ? 'bg-trust/15 text-trust' : 'bg-brass/10 text-brass')}>
                          {followUp ? <CalendarClock className="h-4 w-4" aria-hidden /> : <StickyNote className="h-4 w-4" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-faint">
                            <span className="font-semibold text-paper">{mine ? 'Tú' : authorName.get(n.author_id) ?? 'Miembro de la agencia'}</span>
                            {' · '}{relativeTime(n.created_at)}{n.updated_at > n.created_at && ' · editada'}
                          </p>
                          <NoteBody id={n.id} athleteId={e.athleteId} body={n.body} done={n.done} canEdit={mine} />
                          {followUp && (
                            <p className={cx('mt-1.5 text-xs', overdue ? 'text-danger' : n.done ? 'text-ok' : 'text-muted')}>
                              {n.done ? `Completado ${n.done_at ? relativeTime(n.done_at) : ''}` : dueText(n.due_date)}
                            </p>
                          )}
                        </div>
                        {mine && (
                          <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            {followUp && (
                              <form action={toggleFollowUp}>
                                <input type="hidden" name="id" value={n.id} />
                                <input type="hidden" name="athlete_id" value={e.athleteId} />
                                <input type="hidden" name="done" value={String(!n.done)} />
                                <button className="rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ok" aria-label={n.done ? 'Reabrir seguimiento' : 'Marcar como hecho'}>
                                  {n.done ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                                </button>
                              </form>
                            )}
                            <form action={deleteAgencyNote}>
                              <input type="hidden" name="id" value={n.id} />
                              <input type="hidden" name="athlete_id" value={e.athleteId} />
                              <button className="rounded-lg p-2 text-faint transition-colors hover:bg-danger/10 hover:text-danger" aria-label="Eliminar nota">
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === 'actividad' && (
        <Panel title="Actividad">
          <ActivityFeed events={timeline} showAthlete={false} />
        </Panel>
      )}

      {tab === 'procesos' && (
        <Panel title="Procesos con universidades" action={<ButtonLink href={`/app/pipeline?athlete=${e.athleteId}`} variant="secondary">Abrir o ver en Procesos</ButtonLink>}>
          {cases.length ? (
            <ul className="divide-y divide-line">
              {cases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/app/pipeline/${c.id}`} className="font-semibold text-paper hover:text-brass">{c.institutionName}</Link>
                    <p className="text-xs text-faint">{c.cycle} · {c.ownerName ?? 'Sin responsable'}{c.nextAction ? ` · ${c.nextAction}` : ''}</p>
                  </div>
                  <span className="flex gap-1">
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{stageLabel(c.stage)}</span>
                    {isCaseStale(c) && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">Parado</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {e.status === 'active'
                ? 'Todavía no hay procesos con universidades para este atleta.'
                : 'Los procesos solo se abren cuando el atleta ha aceptado la representación.'}
            </p>
          )}
        </Panel>
      )}

      {tab === 'pasos' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Pendiente">
            <NextStepsList
              steps={steps}
              showAthlete={false}
              empty="No hay seguimientos abiertos."
              action={(s) => s.authorId === userId ? (
                <form action={toggleFollowUp}>
                  <input type="hidden" name="id" value={s.noteId} />
                  <input type="hidden" name="athlete_id" value={e.athleteId} />
                  <input type="hidden" name="done" value="true" />
                  <button className="rounded-lg p-2 text-faint transition-colors hover:bg-surface-2 hover:text-ok" aria-label="Marcar como hecho"><Check className="h-4 w-4" aria-hidden /></button>
                </form>
              ) : null}
            />
          </Panel>
          {canNote && <NoteComposer agencyId={e.agencyId} athleteId={e.athleteId} />}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5 last:border-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-right font-medium text-paper">{children}</dd>
    </div>
  );
}

function FactsPanel({ title, rows, empty }: { title: string; rows: [string, string | null][]; empty: string }) {
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  return (
    <Panel title={title}>
      {!shown.length ? <p className="px-3 py-6 text-center text-sm text-muted">{empty}</p> : (
        <dl className="grid gap-x-8 px-2 sm:grid-cols-2">
          {shown.map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
        </dl>
      )}
    </Panel>
  );
}
