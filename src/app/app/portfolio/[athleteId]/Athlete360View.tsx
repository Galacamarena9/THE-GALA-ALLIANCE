import Link from 'next/link';
import {
  FileText,
  ArrowLeft, ArrowRight, CalendarClock, Check, CircleDashed, Clock, ExternalLink, FileCheck2, Lock, MapPin, MessageSquare,
  MoreHorizontal, RotateCcw, Search, ShieldCheck, StickyNote, Trash2, Video,
} from 'lucide-react';
import { deleteAgencyNote, toggleFollowUp } from '@/app/actions/portfolio';
import { ButtonLink, Notice, buttonClass, cx } from '@/components/ui';
import { AthleteAvatar, NextStepsList, Panel, StatusPill } from '@/components/portfolio';
import { EndRepresentationForm, NoteBody, NoteComposer } from '@/components/portfolio-client';
import { DIVISION_LABEL } from '@/lib/domain/labels';
import { isOverdue, dueText as noteDueText, nextSteps, relativeTime, REP_PERMISSIONS, REP_TYPE_LABEL, repStatusDetail } from '@/lib/domain/portfolio';
import { isCaseStale, stageLabel } from '@/lib/domain/agency-cases';
import { PIPELINE_BUCKETS, dueText } from '@/lib/domain/agent-home';
import { A360_TABS, DOC_STATE_LABEL, WAITING_LABEL, a360Href, type A360Tab, type ChecklistRow, type Journey } from '@/lib/domain/athlete-360';
import type { Athlete360 } from '@/lib/data/athlete-360';
import type { Division } from '@/lib/types';

const SCHOOL_YEAR: Record<string, string> = { eso_3: '3.º ESO', eso_4: '4.º ESO', bach_1: '1.º Bachillerato', bach_2: '2.º Bachillerato', graduated: 'Graduado', college: 'Universidad' };
const SIDE: Record<string, string> = { left: 'Izquierda', right: 'Derecha', both: 'Ambas' };
const ROLE_LABEL: Record<string, string> = { primary: 'Agente principal', secondary: 'Agente de apoyo', operations: 'Operaciones', collaborator: 'Colaborador', viewer: 'Solo lectura' };
const CAT: Record<string, string> = { university: 'Universidades', club: 'Clubes', academy: 'Academias', brand: 'Marcas' };
const place = (v: string) => ({ WORLD: 'Todo el mundo', EUROPE: 'Europa', NORTH_AMERICA: 'Norteamérica', LATAM: 'Latinoamérica' } as Record<string, string>)[v] ?? v;
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const flag = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');
const usd = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('es-ES')} $`);

export function Athlete360View({ data, tab, userId, now = new Date() }: { data: Athlete360; tab: A360Tab; userId: string; now?: Date }) {
  const { ws, access, journey } = data;
  const e = ws.current;
  const today = now.toISOString().slice(0, 10);
  const others = ws.roster.filter((r) => r.athleteId !== e.athleteId);
  const steps = nextSteps(ws.notes, new Map([[e.athleteId, e.name]]), now);
  const counts: Partial<Record<A360Tab, number>> = {
    oportunidades: (data.offers?.length ?? 0) + data.opportunities.length,
    recruiting: data.cases.filter((c) => c.stage !== 'committed' && c.stage !== 'closed').length,
    documentos: data.documents.filter((d) => d.state === 'shared').length,
  };
  const messageHref = data.conversation ? `/app/inbox/${data.conversation.id}` : access.messages ? `/athletes/${e.athleteId}` : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/portfolio" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Mis atletas
        </Link>
        {others.length > 0 && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-line px-3 py-1.5 text-sm text-paper hover:border-brass/40">Cambiar de atleta ▾</summary>
            <ul className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-elevated)]">
              {others.map((o) => (
                <li key={o.athleteId}><Link href={a360Href(o.athleteId, tab)} className="block truncate rounded-lg px-3 py-2 text-sm text-paper hover:bg-surface-2/60">{o.name}</Link></li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {data.partial.length > 0 && <Notice tone="warn">No hemos podido cargar: {data.partial.join(', ')}. El resto de la ficha está al día.</Notice>}
      {access.active && !ws.scope.myRole && (
        <Notice tone="warn">No estás asignado a este atleta: ves la ficha de la agencia, pero no actúas en su nombre. Pide a quien dirige la agencia que te asigne.</Notice>
      )}

      {/* Cabecera: identidad pública y estado de la ficha */}
      <header className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5" data-a360="header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <AthleteAvatar name={e.name} src={e.avatarUrl} sport={e.sportName ?? e.sportId} size="xl" className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-bold uppercase text-paper sm:text-3xl">{e.name}</h1>
              <StatusPill status={e.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {[e.sportName, e.positionName, e.country && `${flag(e.country)} ${e.country}`, e.graduationYear && `Promoción ${e.graduationYear}`].filter(Boolean).join(' · ') || 'Sin datos deportivos compartidos'}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden />{data.verification}</span>
              <span title={data.completeness.missing.length ? `Falta: ${data.completeness.missing.join(', ')}` : undefined}>
                Datos clave: <strong className="font-semibold text-paper">{data.completeness.done} de {data.completeness.total}</strong>
              </span>
              {ws.detail.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{ws.detail.city}</span>}
              {access.active && ws.scope.myRole && <span>Tu papel: {ROLE_LABEL[ws.scope.myRole] ?? ws.scope.myRole}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Acciones del atleta" role="group">
            {messageHref && (
              <ButtonLink href={messageHref} variant="secondary" size="sm"><MessageSquare className="h-4 w-4" aria-hidden /> Mensaje</ButtonLink>
            )}
            {access.active && (
              <ButtonLink href={`/app/opportunities/discover?athlete=${e.athleteId}`} variant="secondary" size="sm"><Search className="h-4 w-4" aria-hidden /> Buscar oportunidades</ButtonLink>
            )}
            <details className="relative">
              <summary className={cx(buttonClass('ghost', 'sm'), 'cursor-pointer list-none')} aria-label={`Más acciones para ${e.name}`}>
                <MoreHorizontal className="h-4 w-4" aria-hidden /> Más
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-64 space-y-0.5 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-elevated)]">
                <MenuLink href={`/athletes/${e.athleteId}`}><ExternalLink className="h-4 w-4" aria-hidden /> Perfil público</MenuLink>
                {access.active && <MenuLink href={`/print/informe-familia?a=${e.athleteId}`}><FileText className="h-4 w-4" aria-hidden /> Informe mensual para la familia</MenuLink>}
                {ws.detail.videoUrl && <MenuLink href={ws.detail.videoUrl} external><Video className="h-4 w-4" aria-hidden /> Vídeo</MenuLink>}
                {access.write && <MenuLink href={a360Href(e.athleteId, 'actividad', 'nota')}><StickyNote className="h-4 w-4" aria-hidden /> Añadir nota</MenuLink>}
                {access.pipeline && access.write && <MenuLink href={`/app/pipeline?athlete=${e.athleteId}`}><ArrowRight className="h-4 w-4" aria-hidden /> Abrir un proceso</MenuLink>}
                {!messageHref && <p className="px-3 py-2 text-xs text-faint">Mensajes: el atleta no te ha dado permiso para participar en sus conversaciones.</p>}
                {(e.status === 'requested' || e.status === 'active') && access.write && (
                  <div className="border-t border-line px-2 pt-2"><EndRepresentationForm id={e.repId} agencyId={e.agencyId} athleteId={e.athleteId} from={e.status} /></div>
                )}
              </div>
            </details>
          </div>
        </div>
      </header>

      <JourneyHero j={journey} />

      <nav aria-label="Secciones de la ficha" className="flex gap-1 overflow-x-auto border-b border-line">
        {A360_TABS.map((t) => {
          const n = counts[t.id];
          return (
            <Link
              key={t.id}
              id={`tab-${t.id}`}
              href={a360Href(e.athleteId, t.id)}
              scroll={false}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cx('relative shrink-0 px-3 pb-3 pt-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50', tab === t.id ? 'font-semibold text-paper' : 'text-muted hover:text-paper')}
            >
              {t.label}
              {n ? <span className="ml-1.5 text-xs tabular-nums text-faint" aria-label={` (${n})`}>{n}</span> : null}
              {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brass" aria-hidden />}
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby={`tab-${tab}`} data-a360-panel={tab}>
        {tab === 'resumen' && <SummaryTab data={data} steps={steps} />}
        {tab === 'oportunidades' && <OpportunitiesTab data={data} today={today} />}
        {tab === 'recruiting' && <RecruitingTab data={data} today={today} />}
        {tab === 'documentos' && <DocumentsTab data={data} messageHref={messageHref} />}
        {tab === 'actividad' && <ActivityTab data={data} userId={userId} steps={steps} />}
      </section>
    </div>
  );
}

// ─── C · Recorrido actual ───────────────────────────────────────────────────

const JOURNEY_TONE: Record<Journey['state'], string> = {
  action: 'border-brass/50', waiting: 'border-trust/40', calm: 'border-ok/40', none: 'border-line', pending_rep: 'border-warn/40', inactive: 'border-line',
};

export function JourneyHero({ j }: { j: Journey }) {
  const dueCls = j.dueState === 'overdue' ? 'text-danger' : j.dueState === 'today' || j.dueState === 'soon' ? 'text-warn' : 'text-paper';
  return (
    <section aria-labelledby="recorrido-t" data-a360="journey" className={cx('rounded-[var(--radius-card)] border-2 bg-surface p-4 sm:p-5', JOURNEY_TONE[j.state])}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recorrido-t" className="text-xs font-semibold uppercase tracking-wide text-faint">Recorrido actual</h2>
        {j.more > 0 && <p className="text-xs text-muted">+{j.more} {j.more === 1 ? 'asunto abierto más' : 'asuntos abiertos más'}</p>}
      </div>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug text-paper sm:text-xl" data-journey-next>{j.nextAction}</p>
          <p className="mt-1 text-sm text-muted">{[j.organization, j.opportunity && j.opportunity !== `Proceso ${j.organization}` ? j.opportunity : null].filter(Boolean).join(' · ') || 'Sin organización asignada'}</p>
        </div>
        {j.resolve && <ButtonLink href={j.resolve.href} data-cta="primary" className="shrink-0">{j.state === 'action' ? 'Resolver ahora' : j.resolve.label}<ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-4">
        <Fact label="Fase">{j.stage ?? '—'}</Fact>
        <Fact label="Plazo"><span className={dueCls}>{j.dueLabel ?? 'Sin fecha'}</span></Fact>
        <Fact label="Depende de">{WAITING_LABEL[j.waitingOn]}</Fact>
        <Fact label="Siguiente paso">{j.resolve?.label ?? '—'}</Fact>
      </dl>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-paper">{children}</dd>
    </div>
  );
}

// ─── Pestañas ───────────────────────────────────────────────────────────────

function SummaryTab({ data, steps }: { data: Athlete360; steps: ReturnType<typeof nextSteps> }) {
  const { ws, access } = data;
  const e = ws.current;
  const d = ws.detail;
  const scope = ws.scope;
  const statusNote = repStatusDetail(scope.dbStatus);
  const sports: [string, string | null][] = [
    ['Deporte', e.sportName], ['Posición', e.positionName], ['Promoción', e.graduationYear ? String(e.graduationYear) : null],
    ['Equipo actual', e.currentTeam], ['Nivel competitivo', d.competitiveLevel], ['Altura', d.heightCm ? `${d.heightCm} cm` : null],
    ['Lado dominante', d.dominantSide ? SIDE[d.dominantSide] ?? d.dominantSide : null],
    ['Divisiones objetivo', d.targetDivisions.length ? d.targetDivisions.map((x) => DIVISION_LABEL[x as Division] ?? x).join(', ') : null],
  ];
  const academics: [string, string | null][] = [
    ['Curso', d.schoolYear ? SCHOOL_YEAR[d.schoolYear] ?? d.schoolYear : null],
    ['Nota media', d.gpa != null ? `${d.gpa} / ${d.gpaScale ?? 4}` : null],
    ['Inglés', d.englishTest && d.englishTest !== 'none' ? `${d.englishTest.toUpperCase()}${d.englishScore ? ` · ${d.englishScore}` : ''}` : null],
    ['SAT', d.sat ? String(d.sat) : null], ['Carrera de interés', d.intendedMajor],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FactsPanel title="Perfil deportivo" rows={sports} empty="El atleta aún no ha completado o compartido sus datos deportivos. Pídeselo por mensaje." />
        <FactsPanel title="Datos académicos" rows={academics} empty="No hay datos académicos visibles: el atleta decide quién los ve. Pídele que los comparta con tu agencia." />
        {d.bio && <Panel title="Sobre el atleta"><p className="whitespace-pre-wrap px-2 py-1 text-sm leading-relaxed text-muted">{d.bio}</p></Panel>}
      </div>
      <div className="space-y-5">
        <Panel title="Representación">
          <dl className="px-2 text-sm">
            <Row label="Estado"><StatusPill status={e.status} /></Row>
            {statusNote && <Row label="Detalle">{statusNote}</Row>}
            <Row label="Agencia">{e.agencyName}</Row>
            {scope.type && <Row label="Tipo">{REP_TYPE_LABEL[scope.type] ?? scope.type}</Row>}
            {scope.startDate && scope.endDate && <Row label="Vigencia">{dateFmt(scope.startDate)} → {dateFmt(scope.endDate)}</Row>}
            {scope.daysLeft != null && scope.daysLeft <= 30 && <Row label="Vence"><span className={scope.daysLeft <= 7 ? 'text-danger' : 'text-warn'}>{scope.daysLeft <= 0 ? 'Hoy' : `En ${scope.daysLeft} días`}</span></Row>}
            {scope.territories.length > 0 && <Row label="Territorio">{scope.territories.map(place).join(', ')}</Row>}
            {scope.categories.length > 0 && <Row label="Oportunidades">{scope.categories.map((c) => CAT[c] ?? c).join(', ')}</Row>}
          </dl>
          {scope.permissions.length > 0 && access.active && (
            <details className="mx-2 mb-2 mt-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-faint">El atleta te permite ({scope.permissions.length})</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {REP_PERMISSIONS.filter((p) => scope.permissions.includes(p.id)).map((p) => <li key={p.id} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{p.label}</li>)}
              </ul>
              <p className="mt-2 text-[11px] text-faint">Aceptar ofertas, el presupuesto familiar y las notas de la familia quedan siempre fuera.</p>
            </details>
          )}
        </Panel>
        <OfficialSourcesPanel data={data} />
        <Panel title="Seguimientos" action={<Link href={a360Href(e.athleteId, 'actividad')} className="text-xs font-medium text-brass hover:underline">Ver actividad</Link>}>
          <NextStepsList steps={steps.slice(0, 3)} showAthlete={false} empty="Sin seguimientos abiertos. Programa uno desde Actividad." />
        </Panel>
      </div>
    </div>
  );
}

function OpportunitiesTab({ data, today }: { data: Athlete360; today: string }) {
  const { access, offers, opportunities } = data;
  const e = data.ws.current;
  if (!access.active) return <Empty icon={Lock} title="Sin representación activa">Las oportunidades y ofertas se gestionan cuando el atleta acepta tu representación.</Empty>;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Ofertas recibidas">
        {offers == null ? (
          <Empty icon={Lock} title="Sin permiso para ver ofertas">El atleta no te ha dado permiso para ver sus ofertas. Pídeselo si necesitas ayudarle a compararlas.</Empty>
        ) : !offers.length ? (
          <Empty icon={CircleDashed} title="Todavía no hay ofertas">Cuando una universidad o club le haga una oferta aparecerá aquí con su coste neto y sus señales de alarma.</Empty>
        ) : (
          <ul className="divide-y divide-line" aria-label="Ofertas">
            {offers.map((o) => (
              <li key={o.key} className="px-2 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-paper">{o.orgName}</p>
                    <p className="text-xs text-muted">{o.source === 'external' ? 'Recibida fuera de la plataforma' : o.title} · Ayuda {usd(o.aidUsd)}/año · Neto {usd(o.netUsd)}</p>
                  </div>
                  {o.deadline && <span className={cx('text-xs font-medium', o.deadline < today ? 'text-faint' : 'text-warn')}>{o.deadline < today ? 'Plazo cerrado' : `Decide: ${dueText(o.deadline, today)}`}</span>}
                </div>
                {o.flags.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {o.flags.slice(0, 2).map((f) => <li key={f.code} className={f.severity === 'high' ? 'text-danger' : 'text-warn'}>{f.text}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="px-2 pb-2 pt-1 text-[11px] text-faint">Aceptar o rechazar una oferta es siempre decisión del atleta.</p>
      </Panel>
      <Panel title="Encajan con su perfil" action={<Link href="/app/opportunities" className="text-xs font-medium text-brass hover:underline">Ver todas</Link>}>
        {!opportunities.length ? (
          <Empty icon={Search} title="Sin oportunidades que encajen ahora" action={<ButtonLink href="/app/opportunities" variant="secondary" size="sm">Buscar oportunidades</ButtonLink>}>
            {e.sportId ? 'No hay oportunidades abiertas de organizaciones verificadas para su deporte y promoción.' : 'Sin deporte compartido no podemos proponer oportunidades: pide al atleta que lo complete.'}
          </Empty>
        ) : (
          <ul className="divide-y divide-line" aria-label="Oportunidades que encajan">
            {opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
                <div className="min-w-0">
                  <Link href={`/app/opportunities/${o.id}`} className="font-semibold text-paper hover:text-brass">{o.title}</Link>
                  <p className="text-xs text-muted">{o.organization}{o.deadline ? ` · cierra ${dueText(o.deadline, today).toLowerCase()}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function RecruitingTab({ data, today }: { data: Athlete360; today: string }) {
  const { access, cases } = data;
  const e = data.ws.current;
  const order = PIPELINE_BUCKETS.flatMap((b) => b.stages as readonly string[]);
  const sorted = [...cases].sort((a, b) => order.indexOf(b.stage) - order.indexOf(a.stage) || (a.nextActionDue ?? '9999').localeCompare(b.nextActionDue ?? '9999'));
  return (
    <Panel title="Procesos con universidades y clubes" action={access.pipeline && access.write ? <ButtonLink href={`/app/pipeline?athlete=${e.athleteId}`} variant="secondary" size="sm">Abrir un proceso</ButtonLink> : undefined}>
      {!access.active ? (
        <Empty icon={Lock} title="Sin representación activa">Los procesos se abren cuando el atleta ha aceptado tu representación.</Empty>
      ) : !cases.length ? (
        <Empty icon={CircleDashed} title="Ningún proceso todavía" action={access.write ? <ButtonLink href={`/app/pipeline?athlete=${e.athleteId}`} size="sm">Abrir el primer proceso</ButtonLink> : undefined}>
          Abre un proceso por cada universidad o club con el que vayas a hablar: aquí verás su fase, el siguiente paso y quién lo lleva.
        </Empty>
      ) : (
        <ul className="divide-y divide-line" aria-label="Procesos">
          {sorted.map((c) => {
            const overdue = c.nextActionDue != null && c.nextActionDue < today && c.stage !== 'committed' && c.stage !== 'closed';
            return (
              <li key={c.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/app/pipeline/${c.id}`} className="font-semibold text-paper hover:text-brass">{c.institutionName}</Link>
                  <p className="text-xs text-muted">{stageLabel(c.stage)} · {c.cycle} · {c.ownerName ?? 'Sin responsable'}</p>
                  {c.nextAction && <p className={cx('mt-0.5 text-sm', overdue ? 'text-danger' : 'text-paper')}>{c.nextAction}{c.nextActionDue ? ` · ${dueText(c.nextActionDue, today)}` : ''}</p>}
                </div>
                {isCaseStale(c) && <span className="w-fit rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">Parado más de 14 días</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const DOC_ICON: Record<ChecklistRow['state'], { icon: typeof Check; cls: string }> = {
  shared: { icon: FileCheck2, cls: 'text-ok' }, requested: { icon: Clock, cls: 'text-warn' }, declined: { icon: CircleDashed, cls: 'text-danger' },
  not_shared: { icon: CircleDashed, cls: 'text-faint' }, locked: { icon: Lock, cls: 'text-faint' },
};

function DocumentsTab({ data, messageHref }: { data: Athlete360; messageHref: string | null }) {
  const { access, documents, evidence } = data;
  const shared = documents.filter((d) => d.state === 'shared').length;
  const groups: { id: ChecklistRow['group']; title: string }[] = [{ id: 'process', title: 'Para el proceso' }, { id: 'arrival', title: 'Visado y llegada (tras aceptar una oferta)' }];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Documentos">
        {!access.documents ? (
          <Notice tone="neutral">El atleta no te ha dado permiso para ver sus documentos. Puedes ver qué se necesita, pero no el estado de cada uno.</Notice>
        ) : (
          <p className="px-2 pb-2 text-sm text-muted">
            {shared ? `${shared} de ${documents.length} compartidos con tu agencia.` : 'Todavía no te ha compartido ningún documento.'}{' '}
            {shared < documents.length && (access.requestDocuments && messageHref
              ? <>Pídele lo que necesites <Link href={messageHref} className="font-medium text-brass hover:underline">por mensaje</Link>.</>
              : 'Solo el atleta (o su familia) decide qué comparte.')}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.id} className="mt-2">
            <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-faint">{g.title}</h3>
            <ul className="divide-y divide-line" aria-label={g.title}>
              {documents.filter((d) => d.group === g.id).map((d) => {
                const I = DOC_ICON[d.state];
                return (
                  <li key={d.kind} className="flex items-start gap-3 px-2 py-2.5" data-doc={d.kind} data-state={d.state}>
                    <I.icon className={cx('mt-0.5 h-4 w-4 shrink-0', I.cls)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-paper">{d.title}</p>
                      <p className="text-xs text-muted">{d.when} · {d.why}</p>
                    </div>
                    <span className="shrink-0 text-right text-xs text-muted">{DOC_STATE_LABEL[d.state]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Panel>
      <Panel title="Evidencias">
        <ul className="space-y-1 px-2">
          {evidence.map((v) => (
            <li key={v.label} className="flex items-center justify-between gap-3 border-b border-line/70 py-2 last:border-0">
              <span className="text-sm text-paper">{v.label}</span>
              <span className={cx('text-right text-xs', v.ok ? 'text-ok' : v.ok === false ? 'text-muted' : 'text-faint')}>{v.detail}</span>
            </li>
          ))}
        </ul>
        <p className="px-2 pb-1 pt-2 text-[11px] text-faint">«Validado» solo cuando lo respalda un club o un documento. Lo declarado por el atleta se indica como tal.</p>
      </Panel>
    </div>
  );
}

function ActivityTab({ data, userId, steps }: { data: Athlete360; userId: string; steps: ReturnType<typeof nextSteps> }) {
  const { ws, access, activity } = data;
  const e = ws.current;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Actividad">
        {!activity.length ? (
          <Empty icon={CircleDashed} title="Sin actividad todavía">{access.write ? 'Añade una nota o programa un seguimiento: quedará aquí para todo tu equipo.' : 'Cuando tu equipo trabaje con este atleta, lo verás aquí.'}</Empty>
        ) : (
          <ol className="space-y-1" aria-label="Actividad del atleta">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-xl px-2 py-2.5" data-activity={a.source}>
                <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', a.source === 'note' ? 'bg-brass/10 text-brass' : a.source === 'process' ? 'bg-trust/15 text-trust' : 'bg-surface-2 text-muted')}>
                  {a.source === 'note' ? <StickyNote className="h-3.5 w-3.5" aria-hidden /> : a.source === 'process' ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-paper">{a.href ? <Link href={a.href} className="hover:text-brass">{a.title}</Link> : a.title}</p>
                  {a.detail ? <p className="mt-0.5 text-xs text-muted">{a.detail}</p> : a.source === 'note' && !access.noteBodies ? <p className="mt-0.5 text-xs italic text-faint">Nota interna: tu rol no permite leer su contenido.</p> : null}
                  <p className="mt-0.5 text-[11px] text-faint">{[a.actor, relativeTime(a.at)].filter(Boolean).join(' · ')}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <div className="space-y-5" id="nota">
        {access.write && access.noteBodies ? <NoteComposer agencyId={e.agencyId} athleteId={e.athleteId} /> : (
          <p className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm text-muted">{e.status === 'declined' ? 'El atleta rechazó la propuesta: no se pueden añadir notas.' : 'Tu rol es de solo lectura: no puedes añadir notas.'}</p>
        )}
        {access.noteBodies && (
          <Panel title="Seguimientos abiertos">
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
        )}
        {access.noteBodies && ws.notes.some((n) => n.author_id === userId) && <MyNotes data={data} userId={userId} />}
      </div>
    </div>
  );
}

/** Edición de mis notas (solo el autor puede cambiar o borrar las suyas; la RLS lo garantiza). */
function MyNotes({ data, userId }: { data: Athlete360; userId: string }) {
  const e = data.ws.current;
  const mine = data.ws.notes.filter((n) => n.author_id === userId);
  return (
    <Panel title="Mis notas">
      <ul className="space-y-1">
        {mine.map((n) => {
          const followUp = n.kind === 'follow_up';
          const overdue = followUp && !n.done && isOverdue(n.due_date);
          return (
            <li key={n.id} className="group rounded-xl px-2 py-2.5 hover:bg-surface-2/50">
              <div className="flex items-start gap-2">
                <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', followUp ? 'bg-trust/15 text-trust' : 'bg-brass/10 text-brass')}>
                  {followUp ? <CalendarClock className="h-3.5 w-3.5" aria-hidden /> : <StickyNote className="h-3.5 w-3.5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-faint">{relativeTime(n.created_at)}{n.updated_at > n.created_at && ' · editada'}</p>
                  <NoteBody id={n.id} athleteId={e.athleteId} body={n.body} done={n.done} canEdit />
                  {followUp && <p className={cx('mt-1 text-xs', overdue ? 'text-danger' : n.done ? 'text-ok' : 'text-muted')}>{n.done ? 'Completado' : noteDueText(n.due_date)}</p>}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  {followUp && (
                    <form action={toggleFollowUp}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="athlete_id" value={e.athleteId} />
                      <input type="hidden" name="done" value={String(!n.done)} />
                      <button className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-ok" aria-label={n.done ? 'Reabrir seguimiento' : 'Marcar como hecho'}>
                        {n.done ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                      </button>
                    </form>
                  )}
                  <form action={deleteAgencyNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="athlete_id" value={e.athleteId} />
                    <button className="rounded-lg p-2 text-faint hover:bg-danger/10 hover:text-danger" aria-label="Eliminar nota"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ─── Fuentes oficiales ──────────────────────────────────────────────────────

/** Enlaces oficiales del atleta (FIBA, NCAA, ESPN, federación) y búsqueda de su nombre en esas fuentes. Se enlaza; no se copia. */
function OfficialSourcesPanel({ data }: { data: Athlete360 }) {
  const official = data.links.filter((l) => l.official);
  const other = data.links.filter((l) => !l.official);
  return (
    <Panel title="Fuentes oficiales">
      <div className="px-2" data-a360="official">
        {official.length ? (
          <ul className="space-y-1.5" aria-label="Enlaces oficiales del atleta">
            {official.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate text-paper hover:text-brass">{l.official!.label} ↗</a>
                <span className={cx('shrink-0 text-xs', l.verified ? 'text-ok' : 'text-faint')}>{l.verified ? 'Verificado' : 'Sin verificar'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aún no ha enlazado ninguna ficha oficial. Pídele su ficha de la federación o de FIBA.</p>
        )}
        {other.length > 0 && <p className="mt-2 text-xs text-faint">{other.length} {other.length === 1 ? 'enlace más' : 'enlaces más'} de otras webs (vídeo, club, redes).</p>}
        {data.officialSearch.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Buscar su nombre en</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Buscar en fuentes oficiales">
              {data.officialSearch.map((s) => (
                <li key={s.id}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer nofollow" title={s.note} className="inline-flex rounded-full border border-line px-2.5 py-1 text-xs text-paper hover:border-brass/50">{s.label} ↗</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

function Empty({ icon: Icon, title, children, action }: { icon: typeof Check; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center" data-empty>
      <Icon className="h-6 w-6 text-faint" aria-hidden />
      <p className="font-semibold text-paper">{title}</p>
      <p className="max-w-md text-sm text-muted">{children}</p>
      {action}
    </div>
  );
}

function MenuLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <Link href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-paper hover:bg-surface-2/60">
      {children}
    </Link>
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
