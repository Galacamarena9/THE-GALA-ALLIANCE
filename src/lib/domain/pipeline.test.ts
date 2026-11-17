import test from 'node:test';
import assert from 'node:assert/strict';
import { netCost, summarize, urgencyOf } from './pipeline.ts';

const now = new Date('2026-11-17T10:00:00');
const base = { status: 'contacted', next_action_due: null, stage_changed_at: '2026-11-15T00:00:00Z' };

test('pipeline: un siguiente paso vencido marca el proceso como vencido', () => {
  assert.equal(urgencyOf({ ...base, next_action_due: '2026-11-10' }, now).urgency, 'overdue');
});
test('pipeline: un plazo oficial a 5 días es "esta semana"; uno ya pasado no inventa urgencia', () => {
  assert.equal(urgencyOf({ ...base, official_deadline: '2026-11-22' }, now).urgency, 'due_soon');
  assert.equal(urgencyOf({ ...base, official_deadline: '2026-11-01' }, now).urgency, 'ok');
});
test('pipeline: proceso activo sin cambios 21 días = sin movimiento; uno guardado no', () => {
  assert.equal(urgencyOf({ ...base, stage_changed_at: '2026-10-01T00:00:00Z' }, now).urgency, 'stale');
  assert.equal(urgencyOf({ ...base, status: 'saved', stage_changed_at: '2026-10-01T00:00:00Z' }, now).urgency, 'ok');
});
test('pipeline: comprometido, cerrado o archivado no es urgente', () => {
  assert.equal(urgencyOf({ ...base, status: 'committed', next_action_due: '2026-11-01' }, now).urgency, 'done');
  assert.equal(urgencyOf({ ...base, archived_at: '2026-11-01', next_action_due: '2026-11-01' }, now).urgency, 'done');
});
test('ofertas: nunca se resta una beca no confirmada por escrito', () => {
  assert.deepEqual(netCost({ annual_cost_usd: 50000, aid_amount_usd: 30000, in_writing: false, renewable: 'unknown' }), { net: 50000, aidCounted: 0, aidPending: 30000 });
  assert.equal(netCost({ annual_cost_usd: 50000, aid_amount_usd: 30000, in_writing: true, renewable: 'yes' }).net, 20000);
  assert.equal(netCost({ annual_cost_usd: null, aid_amount_usd: 30000, in_writing: true, renewable: 'yes' }).net, null);
});
test('pipeline: resumen por etapa sin contar archivados', () => {
  const s = summarize([{ ...base }, { ...base, status: 'offer' }, { ...base, archived_at: '2026-11-01' }], now);
  assert.equal(s.total, 2); assert.equal(s.active, 2); assert.equal(s.byStage.offer, 1);
});
