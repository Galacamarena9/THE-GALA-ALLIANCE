import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttention, type AgentHomeInput } from './agent-home.ts';
import type { AgencyNote, PortfolioEntry } from './portfolio.ts';
import {
  A360_TAB_IDS, a360Access, a360Href, activityProjection, currentJourney, documentChecklist, parseA360Tab, waitingOnStage,
} from './athlete-360.ts';

const NOW = new Date('2026-11-21T10:00:00Z');
const d = (n: number) => new Date(Date.parse('2026-11-21T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const FULL = ['offers.view', 'documents.view', 'documents.request_share', 'messages.participate', 'pipeline.view'];

const input = (x: Partial<AgentHomeInput> = {}): AgentHomeInput => ({
  athletes: [{ id: 'a1', name: 'Ana', sportId: 's', sportName: 'S', positionName: null, graduationYear: 2027, status: 'active', lastActivityAt: null }],
  offers: [], cases: [], tasks: [], followUps: [], repAlerts: [], opportunities: [], ...x,
});
const journey = (i: AgentHomeInput, repStatus: PortfolioEntry['status'] = 'active') =>
  currentJourney({ athleteId: 'a1', repStatus, attention: buildAttention(i, NOW), cases: i.cases, tasks: i.tasks, offers: i.offers, now: NOW });

test('pestañas: canónicas, enlaces antiguos y URL estable', () => {
  assert.deepEqual(A360_TAB_IDS, ['resumen', 'oportunidades', 'recruiting', 'documentos', 'actividad']);
  assert.deepEqual(parseA360Tab('documentos'), { tab: 'documentos', legacy: false });
  assert.deepEqual(parseA360Tab('procesos'), { tab: 'recruiting', legacy: true });
  assert.deepEqual(parseA360Tab('notas'), { tab: 'actividad', legacy: true });
  assert.deepEqual(parseA360Tab('<script>'), { tab: 'resumen', legacy: false });
  assert.equal(a360Href('x'), '/app/portfolio/x');
  assert.equal(a360Href('x', 'actividad', 'nota'), '/app/portfolio/x?tab=actividad#nota');
});

test('permisos: sin representación activa no hay ofertas ni documentos; solo lectura no recibe cuerpos de notas', () => {
  const pending = a360Access({ repStatus: 'requested', permissions: FULL, agencyRole: 'recruiter', repRole: 'primary' });
  assert.equal(pending.offers || pending.documents || pending.messages || pending.pipeline, false);
  const full = a360Access({ repStatus: 'active', permissions: FULL, agencyRole: 'recruiter', repRole: 'primary' });
  assert.equal(full.offers && full.documents && full.messages && full.noteBodies && full.write, true);
  const viewer = a360Access({ repStatus: 'active', permissions: FULL, agencyRole: 'viewer', repRole: null });
  assert.equal(viewer.noteBodies, false);
  assert.equal(viewer.write, false);
  assert.equal(a360Access({ repStatus: 'active', permissions: FULL, agencyRole: 'athlete_manager', repRole: null }).noteBodies, true);
  const scout = a360Access({ repStatus: 'active', permissions: FULL, agencyRole: 'scout', repRole: null });
  assert.equal(scout.noteBodies, false);
  // Asignado al atleta como agente principal: lee las notas aunque su rol de agencia sea scout.
  assert.equal(a360Access({ repStatus: 'active', permissions: FULL, agencyRole: 'scout', repRole: 'primary' }).noteBodies, true);
  assert.equal(a360Access({ repStatus: 'active', permissions: [], agencyRole: 'owner', repRole: null }).offers, false);
});

test('recorrido: la oferta que caduca manda, depende del atleta y se resuelve en Oportunidades', () => {
  const j = journey(input({
    offers: [{ id: 'o1', athleteId: 'a1', university: 'Lakeshore', aidUsd: 1000, deadline: d(2) }],
    cases: [{ id: 'c1', athleteId: 'a1', institution: 'North', stage: 'active_conversation', nextAction: 'Llamar', nextActionDue: d(-1), updatedAt: NOW.toISOString() }],
  }));
  assert.equal(j.state, 'action');
  assert.equal(j.organization, 'Lakeshore');
  assert.equal(j.waitingOn, 'athlete');
  assert.equal(j.dueLabel, 'En 2 días');
  assert.equal(j.resolve?.href, '/app/portfolio/a1?tab=oportunidades');
  assert.equal(j.more, 1);
});

test('recorrido: tarea vencida → depende de tu agencia, con organización y fase del proceso', () => {
  const j = journey(input({
    cases: [{ id: 'c1', athleteId: 'a1', institution: 'North', stage: 'evaluation_visit', nextAction: null, nextActionDue: null, updatedAt: NOW.toISOString() }],
    tasks: [{ id: 't1', caseId: 'c1', title: 'Enviar expediente', dueDate: d(-3) }],
  }));
  assert.equal(j.nextAction, 'Enviar expediente');
  assert.equal(j.organization, 'North');
  assert.equal(j.stage, 'Visita');
  assert.equal(j.waitingOn, 'you');
  assert.equal(j.dueState, 'overdue');
  assert.equal(j.resolve?.href, '/app/pipeline/c1');
});

test('recorrido: sin urgencias usa el proceso más avanzado; propuesta pendiente y sin procesos', () => {
  const j = journey(input({ cases: [
    { id: 'c1', athleteId: 'a1', institution: 'A', stage: 'research', nextAction: 'Investigar', nextActionDue: d(5), updatedAt: NOW.toISOString() },
    { id: 'c2', athleteId: 'a1', institution: 'B', stage: 'contacted', nextAction: null, nextActionDue: null, updatedAt: d(-20) },
  ] }));
  assert.equal(j.organization, 'B');
  assert.equal(j.waitingOn, 'organization');
  assert.equal(j.nextAction, 'Esperar respuesta de B');
  assert.equal(waitingOnStage('decision_pending'), 'athlete');
  assert.equal(journey(input(), 'requested').state, 'pending_rep');
  const none = journey(input());
  assert.equal(none.state, 'none');
  assert.equal(none.resolve?.label, 'Buscar oportunidades');
  assert.equal(journey(input(), 'ended').resolve, null);
});

test('documentos: compartido, pedido, rechazado, no compartido y bloqueado sin permiso', () => {
  const defs = [
    { kind: 'transcript', title: 'Notas', when: '', why: '' }, { kind: 'english_test', title: 'Inglés', when: '', why: '' },
    { kind: 'passport', title: 'Pasaporte', when: '', why: '' }, { kind: 'i20', title: 'I-20', when: '', why: '' }, { kind: 'sat_act', title: 'SAT', when: '', why: '' },
  ];
  const rows = documentChecklist(defs,
    [{ id: 'd1', kind: 'transcript', title: 'Notas 1.º', uploadedAt: '2026-11-01' }, { id: 'd2', kind: 'passport', title: 'Sin archivo', uploadedAt: null }],
    [{ kind: 'english_certificate', status: 'pending', documentKind: null, createdAt: '2026-11-10' }, { kind: 'document', status: 'declined', documentKind: 'sat_act', createdAt: '2026-11-02' }],
    true);
  assert.deepEqual(rows.map((r) => r.state), ['shared', 'requested', 'not_shared', 'not_shared', 'declined']);
  assert.equal(rows.find((r) => r.kind === 'i20')?.group, 'arrival');
  assert.ok(documentChecklist(defs, [], [], false).every((r) => r.state === 'locked' && r.sharedTitle === null));
});

test('actividad: sin permiso de notas no viaja ningún texto interno', () => {
  const note: AgencyNote = { id: 'n1', agency_id: 'g', athlete_id: 'a1', author_id: 'u1', kind: 'note', body: 'SECRETO interno', due_date: null, done: false, done_at: null, created_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:00:00Z' };
  const entry = { repId: 'r', agencyId: 'g', agencyName: 'G', agentId: 'u1', athleteId: 'a1', status: 'active', message: null, createdAt: '2026-10-01T00:00:00Z', respondedAt: '2026-10-02T00:00:00Z', endedAt: null, name: 'Ana', avatarUrl: null, country: null, sportId: null, sportName: null, positionName: null, graduationYear: null, currentTeam: null, hasVideo: false, lastNoteAt: null } as PortfolioEntry;
  const acts = [{ id: 'x', caseId: 'c1', kind: 'call', fromStage: null, toStage: null, body: 'SECRETO llamada', at: '2026-11-19T10:00:00Z', actorId: 'u1' }];
  const args = { entries: [entry], notes: [note], caseActivities: acts, cases: [{ id: 'c1', institution: 'North' }], stageLabel: (s: string) => s, nameOf: () => 'Luis' };
  const hidden = activityProjection({ ...args, noteBodies: false });
  assert.equal(JSON.stringify(hidden).includes('SECRETO'), false);
  assert.equal(hidden.find((a) => a.source === 'note')?.title, 'Nota interna añadida');
  const shown = activityProjection({ ...args, noteBodies: true });
  assert.ok(JSON.stringify(shown).includes('SECRETO interno'));
  assert.deepEqual(shown.map((a) => a.source), ['note', 'process', 'representation', 'representation']);
});
