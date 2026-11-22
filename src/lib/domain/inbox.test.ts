import test from 'node:test';
import assert from 'node:assert/strict';
import { groupInbox, type InboxThread } from './inbox.ts';
import { nextAction } from './next-action.ts';
import { documentChecklist } from './athlete-360.ts';

const NOW = new Date('2026-11-22T10:00:00Z');
const t = (o: Partial<InboxThread>): InboxThread => ({ id: 't', athleteId: 'a1', athleteName: 'Lucía', organization: 'Agencia Norte', status: 'accepted', isMinor: false, lastMessageAt: null, createdAt: '2026-11-01T00:00:00Z', ...o });

test('bandeja: una fila por atleta, conversaciones dentro de la más reciente a la más antigua', () => {
  const g = groupInbox([
    t({ id: 'x1', athleteId: 'a1', lastMessageAt: '2026-11-10T00:00:00Z' }),
    t({ id: 'x2', athleteId: 'a1', organization: 'Otra', lastMessageAt: '2026-11-20T00:00:00Z' }),
    t({ id: 'y1', athleteId: 'a2', athleteName: 'Pablo', isMinor: true }),
  ], new Map());
  assert.equal(g.length, 2);
  const a1 = g.find((x) => x.athleteId === 'a1')!;
  assert.deepEqual(a1.threads.map((x) => x.id), ['x2', 'x1']);
  assert.equal(g.find((x) => x.athleteId === 'a2')!.isMinor, true);
});

test('bandeja: primero quien tiene algo bloqueado o vencido; el contexto es la acción más urgente', () => {
  const calm = nextAction({ id: 'c1', athleteId: 'a1', institution: 'U1', stage: 'contacted', nextAction: null, nextActionDue: null, updatedAt: '2026-11-21T00:00:00Z' }, { repActive: true }, NOW);
  const late = nextAction({ id: 'c2', athleteId: 'a2', institution: 'U2', stage: 'active_conversation', nextAction: 'Llamar', nextActionDue: '2026-11-01', updatedAt: '2026-11-21T00:00:00Z' }, { repActive: true }, NOW);
  const g = groupInbox([t({ id: 'p', athleteId: 'a1', lastMessageAt: '2026-11-22T00:00:00Z' }), t({ id: 'q', athleteId: 'a2', athleteName: 'Pablo' })], new Map([['a1', [calm]], ['a2', [late]]]));
  assert.deepEqual(g.map((x) => x.athleteId), ['a2', 'a1']);
  assert.equal(g[0].top?.state, 'overdue');
  assert.equal(g[0].openCases, 1);
});

test('documentos: fecha recomendada, respaldo de Evidence y qué procesos los necesitan (sin copiar el documento)', () => {
  const defs = [
    { kind: 'transcript', title: 'Notas', when: 'x', why: 'y' },
    { kind: 'i20', title: 'I-20', when: 'x', why: 'y' },
  ];
  const rows = documentChecklist(defs, [{ id: 'd1', kind: 'transcript', title: 'Notas 2025', uploadedAt: '2026-01-01' }], [], true, {
    dueOf: (k) => (k === 'transcript' ? '2026-06-01' : null), gradeSource: 'documented',
    cases: [{ institution: 'Lakeshore', stage: 'academic_review' }, { institution: 'Northfield', stage: 'contacted' }],
  });
  const tr = rows.find((r) => r.kind === 'transcript')!;
  assert.equal(tr.verification, 'verified');
  assert.deepEqual(tr.neededFor, ['Lakeshore']);
  assert.equal(tr.due, '2026-06-01');
  assert.deepEqual(rows.find((r) => r.kind === 'i20')!.neededFor, []);
  // Sin permiso: se ve qué hace falta y para qué, nunca el estado ni el respaldo.
  const locked = documentChecklist(defs, [], [], false, { cases: [{ institution: 'Lakeshore', stage: 'academic_review' }] });
  assert.ok(locked.every((r) => r.state === 'locked' && r.verification === null && r.sharedTitle === null));
});
