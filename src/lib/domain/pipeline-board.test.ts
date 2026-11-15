import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_PHASES, boardColumns, nextStatus, phaseOf } from './pipeline-board.ts';

test('5 fases cubren los 10 estados sin repetir', () => {
  const all = BOARD_PHASES.flatMap((p) => p.statuses);
  assert.equal(BOARD_PHASES.length, 5);
  assert.equal(new Set(all).size, 10);
});

test('cada estado pertenece a su fase', () => {
  assert.equal(phaseOf('applied'), 'new');
  assert.equal(phaseOf('information_requested'), 'contact');
  assert.equal(phaseOf('tryout'), 'evaluation');
  assert.equal(phaseOf('accepted'), 'offer');
  assert.equal(phaseOf('declined'), 'closed');
});

test('siguiente paso avanza un estado y se detiene al final', () => {
  assert.equal(nextStatus('applied'), 'reviewed');
  assert.equal(nextStatus('shortlist'), 'offer');
  assert.equal(nextStatus('offer'), 'accepted');
  assert.equal(nextStatus('accepted'), null);
  assert.equal(nextStatus('declined'), null);
});

test('las columnas salen siempre, también vacías, en orden', () => {
  const cols = boardColumns([{ id: 'a', status: 'interview' }, { id: 'b', status: 'applied' }, { id: 'c', status: 'reviewed' }]);
  assert.deepEqual(cols.map((c) => c.key), ['new', 'contact', 'evaluation', 'offer', 'closed']);
  assert.deepEqual(cols[0].items.map((i) => i.id), ['b', 'c']);
  assert.equal(cols[1].items.length, 0);
});
