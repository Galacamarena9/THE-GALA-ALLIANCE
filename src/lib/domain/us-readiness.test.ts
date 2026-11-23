import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usReadiness } from './us-readiness.ts';
import type { ChecklistRow } from './athlete-360.ts';

const row = (kind: string, state: ChecklistRow['state'], due: string | null = null): ChecklistRow => ({
  kind, title: kind, when: '', why: '', state, group: 'process', sharedTitle: null, due,
});

test('hitos: listo, pedido, vencido y visado solo tras la oferta', () => {
  const rows = [
    row('highlight_video', 'shared'),
    row('transcript', 'shared'), row('translation', 'requested', '2026-01-01'),
    row('english_test', 'not_shared', '2026-01-01'),
    row('passport', 'not_shared', '2027-06-01'),
    row('i20', 'not_shared', '2026-02-01'), row('ds160', 'not_shared'),
  ];
  const r = usReadiness(rows, '2026-11-23');
  const by = Object.fromEntries(r.milestones.map((m) => [m.key, m.state]));
  assert.deepEqual(by, { video: 'done', academic: 'requested', english: 'overdue', eligibility: 'unknown', passport: 'pending', visa: 'later' });
  assert.equal(r.total, 5);
  assert.equal(r.done, 1);
});

test('sin permiso no afirma nada y no cuenta en el total', () => {
  const rows = ['highlight_video', 'transcript', 'translation', 'english_test', 'passport', 'i20'].map((k) => row(k, 'locked'));
  const r = usReadiness(rows, '2026-11-23', { committed: true });
  assert.ok(r.milestones.filter((m) => m.key !== 'eligibility').every((m) => m.state === 'locked'));
  assert.equal(r.total, 1);
});

test('tras comprometerse, el visado cuenta y puede vencer', () => {
  const r = usReadiness([row('i20', 'not_shared', '2026-01-01')], '2026-11-23', { committed: true });
  assert.equal(r.milestones.find((m) => m.key === 'visa')!.state, 'overdue');
});
