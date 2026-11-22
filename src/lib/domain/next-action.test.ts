import test from 'node:test';
import assert from 'node:assert/strict';
import { compareActions, nextAction, phaseOf, type NACase, type NAContext } from './next-action.ts';

const NOW = new Date('2026-11-22T10:00:00Z');
const c = (o: Partial<NACase> = {}): NACase => ({ id: 'c1', athleteId: 'a1', institution: 'Universidad Ficticia', stage: 'active_conversation', nextAction: null, nextActionDue: null, updatedAt: '2026-11-20T10:00:00Z', ...o });
const ok: NAContext = { repActive: true };

test('determinista: mismas entradas y fecha → misma acción', () => {
  const a = nextAction(c(), ok, NOW);
  const b = nextAction(c(), ok, NOW);
  assert.deepEqual(a, b);
});

test('sin representación activa: bloqueado, manda sobre todo (incluso una oferta que caduca)', () => {
  const n = nextAction(c({ stage: 'offer_discussion' }), { repActive: false, offer: { deadline: '2026-11-23' } }, NOW);
  assert.equal(n.state, 'blocked');
  assert.equal(n.actor, 'agent');
  assert.match(n.blocker ?? '', /representación no está activa/);
});

test('menor sin aprobación del tutor: bloqueado y en manos de la familia', () => {
  const n = nextAction(c(), { repActive: true, guardianPending: true }, NOW);
  assert.equal(n.state, 'blocked');
  assert.equal(n.actor, 'family');
});

test('oferta: caduca en ≤ 7 días → decide el atleta; caducada → vencido para el agente', () => {
  const n = nextAction(c({ stage: 'offer_discussion' }), { ...ok, offer: { deadline: '2026-11-25' } }, NOW);
  assert.equal(n.actor, 'athlete'); assert.equal(n.state, 'soon'); assert.equal(n.due, '2026-11-25');
  const x = nextAction(c({ stage: 'offer_discussion' }), { ...ok, offer: { deadline: '2026-11-20' } }, NOW);
  assert.equal(x.state, 'overdue'); assert.equal(x.actor, 'agent'); assert.ok(x.blocker);
});

test('tarea vencida gana a la próxima acción con fecha futura; la más antigua primero', () => {
  const n = nextAction(c({ nextAction: 'Llamar', nextActionDue: '2026-11-30' }), { ...ok, tasks: [{ title: 'B', dueDate: '2026-11-18' }, { title: 'A', dueDate: '2026-11-15' }] }, NOW);
  assert.equal(n.action, 'A'); assert.equal(n.state, 'overdue'); assert.equal(n.cta.label, 'Hacer tarea');
});

test('documento pedido: espera a la otra parte; a los 7 días, recordatorio del agente', () => {
  const w = nextAction(c(), { ...ok, docRequest: { title: 'Certificado de notas', requestedAt: '2026-11-20T09:00:00Z', fromFamily: true } }, NOW);
  assert.equal(w.state, 'waiting'); assert.equal(w.actor, 'family'); assert.equal(w.due, '2026-11-27'); assert.match(w.blocker ?? '', /certificado de notas/);
  const r = nextAction(c(), { ...ok, docRequest: { title: 'Certificado de notas', requestedAt: '2026-11-10T09:00:00Z', fromFamily: false } }, NOW);
  assert.equal(r.state, 'today'); assert.equal(r.actor, 'agent');
});

test('contactado: espera a la organización y, a los 7 días, seguimiento', () => {
  const w = nextAction(c({ stage: 'contacted', updatedAt: '2026-11-19T00:00:00Z' }), ok, NOW);
  assert.equal(w.state, 'waiting'); assert.equal(w.actor, 'organization');
  const f = nextAction(c({ stage: 'contacted', updatedAt: '2026-11-10T00:00:00Z' }), ok, NOW);
  assert.equal(f.state, 'today'); assert.equal(f.actor, 'agent'); assert.match(f.action, /seguimiento/);
});

test('decisión pendiente: espera al atleta; colocado: preparar la llegada', () => {
  assert.equal(nextAction(c({ stage: 'decision_pending' }), ok, NOW).actor, 'athlete');
  const p = nextAction(c({ stage: 'committed' }), ok, NOW);
  assert.equal(p.state, 'done'); assert.match(p.cta.href, /tab=documentos/);
});

test('parado 14 días: reactivar; sin nada pendiente: acción de la fase', () => {
  assert.match(nextAction(c({ updatedAt: '2026-11-01T00:00:00Z' }), ok, NOW).action, /Reactivar/);
  const n = nextAction(c({ stage: 'approved_to_contact' }), ok, NOW);
  assert.equal(n.state, 'ready'); assert.match(n.action, /Enviar la presentación/);
});

test('cada acción trae un solo botón y como mucho un bloqueo', () => {
  for (const stage of ['research', 'shortlisted', 'contacted', 'response_received', 'active_conversation', 'evaluation_visit', 'offer_discussion', 'decision_pending', 'committed']) {
    const n = nextAction(c({ stage }), ok, NOW);
    assert.ok(n.cta.label && n.cta.href.startsWith('/app/'), stage);
    assert.ok(n.blocker === null || typeof n.blocker === 'string');
  }
});

test('cinco fases: shortlist en Introducción, decisión junto a colocado; orden de trabajo', () => {
  assert.equal(phaseOf('shortlisted')?.id, 'introduction');
  assert.equal(phaseOf('decision_pending')?.id, 'placed');
  assert.equal(phaseOf('closed'), null);
  const list = [
    nextAction(c({ id: 'x', stage: 'committed' }), ok, NOW),
    nextAction(c({ id: 'y' }), { repActive: false }, NOW),
    nextAction(c({ id: 'z', nextAction: 'Llamar', nextActionDue: '2026-11-01' }), ok, NOW),
  ].sort(compareActions);
  assert.deepEqual(list.map((x) => x.state), ['blocked', 'overdue', 'done']);
});
