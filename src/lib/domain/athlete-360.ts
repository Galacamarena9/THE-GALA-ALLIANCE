/**
 * Prompt 7 · Ficha 360 del atleta para el agente. Lógica pura que COMPONE proyecciones existentes
 * (buildAttention del Inicio, procesos de la agencia, ofertas, checklist documental y línea de tiempo de la cartera).
 * No crea datos ni reglas nuevas de negocio: decide qué se enseña, en qué orden y a quién.
 */
import { ATTENTION_RANK, PIPELINE_BUCKETS, dueStateOf, dueText, type AttentionItem, type DueState, type HomeCase, type HomeOffer, type HomeTask } from './agent-home.ts';
import { buildTimeline, type AgencyNote, type PortfolioEntry, type RepStatus } from './portfolio.ts';

// ─── B · Pestañas (contrato de URL) ─────────────────────────────────────────

export const A360_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'actividad', label: 'Actividad' },
] as const;
export type A360Tab = (typeof A360_TABS)[number]['id'];
export const A360_TAB_IDS: A360Tab[] = A360_TABS.map((t) => t.id);

/** Enlaces antiguos (`?tab=notas|pasos|procesos`) siguen funcionando: se resuelven a la pestaña nueva. */
export const LEGACY_A360_TAB: Record<string, A360Tab> = { notas: 'actividad', pasos: 'actividad', procesos: 'recruiting' };

export function parseA360Tab(v: string | string[] | undefined): { tab: A360Tab; legacy: boolean } {
  const s = Array.isArray(v) ? v[0] : v;
  if (s && (A360_TAB_IDS as string[]).includes(s)) return { tab: s as A360Tab, legacy: false };
  if (s && s in LEGACY_A360_TAB) return { tab: LEGACY_A360_TAB[s], legacy: true };
  return { tab: 'resumen', legacy: false };
}

/** Enlace canónico: la pestaña por defecto no lleva parámetro (una sola URL por vista). */
export function a360Href(athleteId: string, tab: A360Tab = 'resumen', anchor?: string): string {
  return `/app/portfolio/${athleteId}${tab === 'resumen' ? '' : `?tab=${tab}`}${anchor ? `#${anchor}` : ''}`;
}

// ─── F · Permisos ───────────────────────────────────────────────────────────

export type AgencyRoleId = 'owner' | 'admin' | 'manager' | 'recruiter' | 'athlete_manager' | 'operations' | 'scout' | 'compliance' | 'viewer';
export type RepRoleId = 'primary' | 'secondary' | 'operations' | 'collaborator' | 'viewer';

export interface A360Access {
  /** La representación está activa: sin ella solo se ve la identidad pública y la propuesta. */
  active: boolean;
  offers: boolean;
  documents: boolean;
  requestDocuments: boolean;
  messages: boolean;
  pipeline: boolean;
  /** Ver el texto de las notas internas de la agencia y de las actividades de los procesos. */
  noteBodies: boolean;
  /** Escribir notas y seguimientos. */
  write: boolean;
}

const BODY_AGENCY_ROLES: AgencyRoleId[] = ['owner', 'admin', 'manager', 'recruiter', 'athlete_manager', 'operations', 'compliance'];
const BODY_REP_ROLES: RepRoleId[] = ['primary', 'secondary', 'operations'];

/**
 * Mapa de permisos de la ficha. La base de datos ya decide (RLS + representation_permissions); esto solo evita
 * PEDIR lo que no se puede ver y quita del payload lo que el rol no debe leer (cuerpos de notas).
 */
export function a360Access(p: { repStatus: RepStatus | string; permissions: string[]; agencyRole: string | null; repRole: string | null }): A360Access {
  const active = p.repStatus === 'active';
  const has = (perm: string) => active && p.permissions.includes(perm);
  const bodyByAgency = p.agencyRole == null || BODY_AGENCY_ROLES.includes(p.agencyRole as AgencyRoleId);
  const bodyByRep = p.repRole != null && BODY_REP_ROLES.includes(p.repRole as RepRoleId);
  const readOnly = p.agencyRole === 'viewer' || p.repRole === 'viewer';
  return {
    active,
    offers: has('offers.view'),
    documents: has('documents.view'),
    requestDocuments: has('documents.request_share'),
    messages: has('messages.participate'),
    pipeline: active,
    // Un «solo lectura» o un scout ve que hubo una nota, no lo que dice (salvo que esté asignado al atleta).
    noteBodies: (bodyByAgency && !readOnly) || bodyByRep,
    write: p.repStatus !== 'declined' && !readOnly,
  };
}

// ─── C · Recorrido actual ───────────────────────────────────────────────────

export type WaitingOn = 'you' | 'athlete' | 'organization' | 'nobody';
export const WAITING_LABEL: Record<WaitingOn, string> = {
  you: 'Tu agencia', athlete: 'El atleta', organization: 'La organización', nobody: 'Nadie: todo al día',
};

export interface Journey {
  state: 'action' | 'waiting' | 'calm' | 'none' | 'pending_rep' | 'inactive';
  organization: string | null;
  opportunity: string | null;
  stage: string | null;
  nextAction: string;
  due: string | null;
  dueState: DueState | null;
  dueLabel: string | null;
  waitingOn: WaitingOn;
  resolve: { label: string; href: string } | null;
  /** Otros asuntos abiertos además del principal. */
  more: number;
}

const FINAL = new Set(['committed', 'closed']);
const STAGE_ORDER = PIPELINE_BUCKETS.flatMap((b) => b.stages as readonly string[]);
const bucketLabel = (stage: string) => PIPELINE_BUCKETS.find((b) => (b.stages as readonly string[]).includes(stage))?.label ?? null;

/** Quién tiene la pelota en cada fase del proceso. */
export function waitingOnStage(stage: string): WaitingOn {
  if (stage === 'contacted' || stage === 'academic_review') return 'organization';
  if (stage === 'offer_discussion' || stage === 'decision_pending') return 'athlete';
  if (FINAL.has(stage)) return 'nobody';
  return 'you';
}

export interface JourneyInput {
  athleteId: string;
  repStatus: RepStatus;
  attention: AttentionItem[];
  cases: HomeCase[];
  tasks: HomeTask[];
  offers: HomeOffer[];
  now?: Date;
}

/**
 * Lo primero que tiene que entender el agente (≤ 10 s): con quién, en qué fase, qué toca, para cuándo,
 * de quién depende y un único botón para resolverlo. Prioridad = la del Inicio (rangos 1–4), luego el proceso más avanzado.
 */
export function currentJourney(i: JourneyInput): Journey {
  const today = (i.now ?? new Date()).toISOString().slice(0, 10);
  const base = { organization: null, opportunity: null, stage: null, due: null, dueState: null, dueLabel: null, more: 0 };
  if (i.repStatus === 'requested') {
    return { ...base, state: 'pending_rep', nextAction: 'Esperar a que el atleta acepte tu propuesta de representación', waitingOn: 'athlete', resolve: { label: 'Ver propuesta', href: a360Href(i.athleteId, 'actividad') } };
  }
  if (i.repStatus !== 'active') {
    return { ...base, state: 'inactive', nextAction: 'Sin representación activa: no puedes actuar en su nombre', waitingOn: 'nobody', resolve: null };
  }

  const mine = i.attention.filter((a) => a.athleteId === i.athleteId && a.rank <= ATTENTION_RANK.visit);
  const caseById = new Map(i.cases.map((c) => [c.id, c]));
  const taskCase = new Map(i.tasks.map((t) => [t.id, t.caseId]));
  const open = i.cases.filter((c) => c.athleteId === i.athleteId && !FINAL.has(c.stage));
  const liveOffers = i.offers.filter((o) => o.athleteId === i.athleteId && (!o.deadline || o.deadline >= today));

  const top = mine[0];
  if (top) {
    const [prefix, id] = [top.key.slice(0, top.key.indexOf(':')), top.key.slice(top.key.indexOf(':') + 1)];
    const caseId = prefix === 'task' ? taskCase.get(id) : ['case', 'reply', 'visit'].includes(prefix) ? id : undefined;
    const c = caseId ? caseById.get(caseId) : undefined;
    const offer = prefix === 'offer' ? liveOffers.find((o) => o.id === id) : undefined;
    const waitingOn: WaitingOn = top.kind === 'offer_expiring' ? 'athlete' : 'you';
    const resolve = prefix === 'offer' ? { label: 'Revisar oferta', href: a360Href(i.athleteId, 'oportunidades') }
      : prefix === 'follow' ? { label: 'Hacer seguimiento', href: a360Href(i.athleteId, 'actividad') }
      : prefix === 'rep' ? { label: 'Revisar representación', href: a360Href(i.athleteId) }
      : { label: top.cta.label, href: top.cta.href };
    return {
      state: 'action',
      organization: c?.institution ?? offer?.university ?? (prefix === 'follow' || prefix === 'rep' ? null : top.context),
      opportunity: offer ? 'Oferta de beca o ayuda' : c ? `Proceso ${c.institution}` : null,
      stage: c ? bucketLabel(c.stage) : offer ? 'Oferta' : null,
      nextAction: top.title,
      due: top.due, dueState: top.dueState, dueLabel: top.due ? dueText(top.due, today) : null,
      waitingOn, resolve, more: mine.length - 1,
    };
  }

  if (open.length) {
    // El proceso más avanzado; a igualdad, el de fecha más próxima.
    const c = [...open].sort((a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage) || (a.nextActionDue ?? '9999').localeCompare(b.nextActionDue ?? '9999'))[0];
    const waitingOn = waitingOnStage(c.stage);
    const nextAction = c.nextAction ?? (waitingOn === 'organization' ? `Esperar respuesta de ${c.institution}` : waitingOn === 'athlete' ? 'El atleta tiene que decidir' : 'Define el siguiente paso del proceso');
    return {
      state: waitingOn === 'you' && !c.nextAction ? 'action' : waitingOn === 'you' ? 'calm' : 'waiting',
      organization: c.institution, opportunity: `Proceso ${c.institution}`, stage: bucketLabel(c.stage), nextAction,
      due: c.nextActionDue, dueState: c.nextActionDue ? dueStateOf(c.nextActionDue, today) : null, dueLabel: c.nextActionDue ? dueText(c.nextActionDue, today) : null,
      waitingOn, resolve: { label: 'Abrir proceso', href: `/app/pipeline/${c.id}` }, more: open.length - 1,
    };
  }

  if (liveOffers.length) {
    const o = [...liveOffers].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))[0];
    return {
      ...base, state: 'waiting', organization: o.university, opportunity: 'Oferta de beca o ayuda', stage: 'Oferta',
      nextAction: 'El atleta decide sobre la oferta', due: o.deadline, dueState: o.deadline ? dueStateOf(o.deadline, today) : null,
      dueLabel: o.deadline ? dueText(o.deadline, today) : null, waitingOn: 'athlete',
      resolve: { label: 'Revisar oferta', href: a360Href(i.athleteId, 'oportunidades') }, more: liveOffers.length - 1,
    };
  }

  const placed = i.cases.find((c) => c.athleteId === i.athleteId && c.stage === 'committed');
  if (placed) {
    return { ...base, state: 'calm', organization: placed.institution, opportunity: `Proceso ${placed.institution}`, stage: 'Colocado', nextAction: 'Preparar la llegada: documentos de visado y viaje', waitingOn: 'athlete', resolve: { label: 'Ver documentos', href: a360Href(i.athleteId, 'documentos') } };
  }
  return { ...base, state: 'none', nextAction: 'Todavía no hay procesos abiertos: busca universidades o clubes que encajen', waitingOn: 'you', resolve: { label: 'Buscar oportunidades', href: a360Href(i.athleteId, 'oportunidades') } };
}

// ─── D · Documentos (lista humana sobre Evidence & Trust) ───────────────────

export type DocState = 'shared' | 'requested' | 'declined' | 'not_shared' | 'locked';
export const DOC_STATE_LABEL: Record<DocState, string> = {
  shared: 'Compartido contigo',
  requested: 'Pedido · lo decide el atleta',
  declined: 'No lo ha compartido',
  not_shared: 'No compartido con tu agencia',
  locked: 'Sin permiso para ver documentos',
};

export interface DocDefinition { kind: string; title: string; when: string; why: string }
export interface VisibleDocument { id: string; kind: string; title: string; uploadedAt: string | null }
export interface DocRequest { kind: string; status: string; documentKind: string | null; createdAt: string }
export interface ChecklistRow {
  kind: string; title: string; when: string; why: string; state: DocState; group: 'process' | 'arrival'; sharedTitle: string | null;
  /** Fecha recomendada para tenerlo (calendario por promoción). */
  due?: string | null;
  /** Respaldo del dato en Evidence: el documento respalda la nota o el inglés del perfil. */
  verification?: 'verified' | 'uploaded' | null;
  /** Procesos abiertos que lo necesitan ahora (se calcula; el documento vive una sola vez en el perfil del atleta). */
  neededFor?: string[];
}

/** Contexto opcional para la lista: promoción, fuentes de Evidence y procesos abiertos (atleta × organización). */
export interface ChecklistContext {
  dueOf?: (kind: string) => string | null;
  gradeSource?: string | null;
  englishSource?: string | null;
  cases?: { institution: string; stage: string }[];
}
const DOC_NEEDED_FROM: Record<string, string[]> = {
  highlight_video: ['contacted', 'response_received', 'active_conversation', 'academic_review', 'evaluation_visit'],
  transcript: ['active_conversation', 'academic_review', 'evaluation_visit', 'offer_discussion', 'decision_pending'],
  translation: ['academic_review', 'offer_discussion', 'decision_pending'],
  english_test: ['academic_review', 'offer_discussion', 'decision_pending'],
  sat_act: ['academic_review'],
  passport: ['offer_discussion', 'decision_pending', 'committed'],
  graduation_proof: ['committed'],
  financial: ['decision_pending', 'committed'],
  i20: ['committed'], sevis_receipt: ['committed'], ds160: ['committed'], medical: ['committed'],
};
const documented = (s: string | null | undefined) => s === 'documented' || s === 'club_verified';

/** Tipos de petición de información (info_requests.kind) que equivalen a un documento de la lista. */
const REQUEST_TO_DOC: Record<string, string> = { transcript: 'transcript', english_certificate: 'english_test', full_game_video: 'highlight_video' };
const ARRIVAL = new Set(['i20', 'sevis_receipt', 'ds160', 'financial', 'medical']);

/**
 * Lista de documentos tal y como la ve la agencia. Solo cuenta lo que la RLS deja leer (concesiones vigentes
 * y peticiones de la propia agencia): nunca afirma que un documento «falta», solo que no se ha compartido.
 */
export function documentChecklist(defs: DocDefinition[], docs: VisibleDocument[], requests: DocRequest[], canView: boolean, ctx: ChecklistContext = {}): ChecklistRow[] {
  return defs.map((d) => {
    const group = ARRIVAL.has(d.kind) ? 'arrival' as const : 'process' as const;
    const extra = {
      due: ctx.dueOf?.(d.kind) ?? null,
      neededFor: [...new Set((ctx.cases ?? []).filter((c) => (DOC_NEEDED_FROM[d.kind] ?? []).includes(c.stage)).map((c) => c.institution))].sort((a, b) => a.localeCompare(b, 'es')),
    };
    if (!canView) return { ...d, group, ...extra, verification: null, state: 'locked' as const, sharedTitle: null };
    const doc = docs.find((x) => x.kind === d.kind && x.uploadedAt);
    const backed = (d.kind === 'transcript' && documented(ctx.gradeSource)) || (d.kind === 'english_test' && documented(ctx.englishSource));
    if (doc) return { ...d, group, ...extra, verification: backed ? 'verified' as const : 'uploaded' as const, state: 'shared' as const, sharedTitle: doc.title };
    const mine = requests.filter((r) => (r.documentKind ?? REQUEST_TO_DOC[r.kind]) === d.kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const state: DocState = !mine ? 'not_shared' : mine.status === 'pending' || mine.status === 'pending_guardian' ? 'requested' : mine.status === 'declined' ? 'declined' : 'not_shared';
    return { ...d, group, ...extra, verification: null, state, sharedTitle: null };
  });
}

export interface Evidence { label: string; ok: boolean | null; detail: string }

/** Señales de Evidence & Trust visibles para la agencia. `null` = el atleta no comparte ese dato contigo. */
export function evidenceSignals(e: { verifiedStats: boolean | null; video: boolean | null; gradeSource: string | null | undefined; englishSource: string | null | undefined; academicsVisible: boolean }): Evidence[] {
  const raised = (s: string | null | undefined) => s === 'documented' || s === 'club_verified';
  return [
    { label: 'Estadísticas', ok: e.verifiedStats, detail: e.verifiedStats == null ? 'No las comparte contigo' : e.verifiedStats ? 'Validadas por su club' : 'Declaradas por el atleta' },
    { label: 'Vídeo', ok: e.video, detail: e.video == null ? 'No lo comparte contigo' : e.video ? 'Disponible' : 'Sin vídeo todavía' },
    { label: 'Nota media', ok: e.academicsVisible ? raised(e.gradeSource) : null, detail: !e.academicsVisible ? 'No la comparte contigo' : raised(e.gradeSource) ? 'Respaldada por documento' : e.gradeSource ? 'Declarada' : 'Sin dato' },
    { label: 'Inglés', ok: e.academicsVisible ? raised(e.englishSource) : null, detail: !e.academicsVisible ? 'No lo comparte contigo' : raised(e.englishSource) ? 'Respaldado por certificado' : e.englishSource ? 'Declarado' : 'Sin dato' },
  ];
}

/** Datos clave para trabajar con el atleta (solo los que tú puedes ver). No es una nota del atleta. */
export function keyCompleteness(f: Record<string, boolean>): { done: number; total: number; missing: string[] } {
  const entries = Object.entries(f);
  return { done: entries.filter(([, v]) => v).length, total: entries.length, missing: entries.filter(([, v]) => !v).map(([k]) => k) };
}

// ─── E · Actividad (según el rol) ───────────────────────────────────────────

export interface CaseActivity { id: string; caseId: string; kind: string; fromStage: string | null; toStage: string | null; body: string | null; at: string; actorId: string | null }
export interface ActivityItem { id: string; at: string; title: string; detail: string | null; source: 'representation' | 'note' | 'process'; href: string | null; actor: string | null }

const CASE_KIND_TITLE: Record<string, string> = { email: 'Email', call: 'Llamada', meeting: 'Reunión', message: 'Mensaje', note: 'Nota del proceso' };

/**
 * Línea de tiempo de la ficha: representación + notas de la agencia + actividad de procesos.
 * Si el rol no puede leer notas internas, el texto NO viaja (se queda «Nota interna» sin cuerpo).
 */
export function activityProjection(p: {
  entries: PortfolioEntry[]; notes: AgencyNote[]; caseActivities: CaseActivity[]; cases: { id: string; institution: string }[];
  stageLabel: (s: string) => string; noteBodies: boolean; nameOf: (id: string | null) => string | null; limit?: number;
}): ActivityItem[] {
  const inst = new Map(p.cases.map((c) => [c.id, c.institution]));
  const authorOf = new Map(p.notes.map((n) => [n.id, n.author_id]));
  const timeline = buildTimeline(p.entries, p.notes).map((ev): ActivityItem => {
    const isNote = ev.kind === 'note' || ev.kind === 'follow_up' || ev.kind === 'follow_up_done';
    const noteId = isNote ? ev.id.slice(0, ev.id.lastIndexOf(':')) : null;
    return {
      id: ev.id, at: ev.at, title: ev.title, source: isNote ? 'note' : 'representation', href: null,
      detail: isNote && !p.noteBodies ? null : ev.detail ?? null,
      actor: noteId ? p.nameOf(authorOf.get(noteId) ?? null) : null,
    };
  });
  const process = p.caseActivities.map((a): ActivityItem => {
    const where = inst.get(a.caseId) ?? 'Proceso';
    const stage = a.kind === 'stage_change';
    return {
      id: `act:${a.id}`, at: a.at, source: 'process', href: `/app/pipeline/${a.caseId}`, actor: p.nameOf(a.actorId),
      title: stage ? `${where}: ${a.fromStage ? `${p.stageLabel(a.fromStage)} → ` : ''}${p.stageLabel(a.toStage ?? '')}` : `${CASE_KIND_TITLE[a.kind] ?? 'Actividad'} · ${where}`,
      detail: stage || !p.noteBodies || !a.body ? null : a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body,
    };
  });
  const all = [...timeline, ...process].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  return p.limit == null ? all : all.slice(0, p.limit);
}
