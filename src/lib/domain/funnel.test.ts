import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthPct, weeklyBuckets } from './funnel.ts';

test('crecimiento frente al periodo anterior', () => {
  assert.equal(growthPct(150, 100), 50);
  assert.equal(growthPct(50, 100), -50);
  assert.equal(growthPct(10, 0), null);
});

test('registros agrupados en 8 semanas, la última es la actual', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const b = weeklyBuckets(['2026-11-16T09:00:00Z', '2026-11-15T09:00:00Z', '2026-11-05T09:00:00Z', '2026-08-01T00:00:00Z'], now, 8);
  assert.equal(b.length, 8);
  assert.equal(b[7].count, 1);
  assert.equal(b[6].count, 1);
  assert.equal(b[5].count, 1);
  assert.equal(b.reduce((a, x) => a + x.count, 0), 3);
});
