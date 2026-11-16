import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREMIUM_FEATURES, featureState, unlockSummary } from './unlocks.ts';

test('8 funciones de pago: 4 de Core y 4 de Elite', () => {
  assert.equal(PREMIUM_FEATURES.length, 8);
  assert.equal(PREMIUM_FEATURES.filter((f) => f.plan === 'family_core').length, 4);
  assert.equal(PREMIUM_FEATURES.filter((f) => f.plan === 'family_elite').length, 4);
});

test('el plan gratis ve todo bloqueado; Core desbloquea lo suyo; Elite y Signature todo', () => {
  const core = PREMIUM_FEATURES.find((f) => f.plan === 'family_core')!;
  const elite = PREMIUM_FEATURES.find((f) => f.plan === 'family_elite')!;
  assert.equal(featureState('free', core), 'locked');
  assert.equal(featureState('family_core', core), 'unlocked');
  assert.equal(featureState('family_core', elite), 'locked');
  assert.equal(featureState('family_signature', elite), 'unlocked');
});

test('resumen: cuántas tiene y cuál es el siguiente plan', () => {
  assert.deepEqual(unlockSummary('free'), { unlocked: 0, total: 8, next: 'family_core' });
  assert.deepEqual(unlockSummary('family_core'), { unlocked: 4, total: 8, next: 'family_elite' });
  assert.deepEqual(unlockSummary('family_elite'), { unlocked: 8, total: 8, next: null });
});
