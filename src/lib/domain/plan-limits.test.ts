import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLimitMessage, planSummary, trialDaysLeft, usageLabel, usageRatio, type AgencyPlanStatus } from './plan-limits.ts';

const base: AgencyPlanStatus = { source: 'trial', plan_code: 'agent_team', trial_ends_at: null, athletes_limit: 100, athletes_used: 3, seats_limit: 5, seats_used: 1 };
const now = new Date('2026-11-24T12:00:00Z');

test('traduce solo los errores de límite de la base de datos', () => {
  assert.match(planLimitMessage('ERROR: plan_athlete_limit') ?? '', /número de atletas/);
  assert.match(planLimitMessage('plan_seat_limit') ?? '', /puestos/);
  assert.equal(planLimitMessage('agency_not_verified'), null);
  assert.equal(planLimitMessage(undefined), null);
});

test('días de prueba: redondea hacia arriba y nunca negativos', () => {
  assert.equal(trialDaysLeft('2026-12-24T12:00:00Z', now), 30);
  assert.equal(trialDaysLeft('2026-11-24T13:00:00Z', now), 1);
  assert.equal(trialDaysLeft('2026-11-20T00:00:00Z', now), 0);
  assert.equal(trialDaysLeft(null, now), 0);
});

test('uso: etiquetas y proporción', () => {
  assert.equal(usageLabel(12, 25), '12 de 25');
  assert.equal(usageLabel(12, -1), '12 · sin límite');
  assert.equal(usageLabel(4, 0), '4 · sin plan activo');
  assert.equal(usageRatio(30, 25), 1);
  assert.equal(usageRatio(5, -1), 0);
  assert.equal(usageRatio(2, 0), 1);
});

test('resumen: prueba, aviso en la última semana, contratado y sin plan', () => {
  assert.equal(planSummary({ ...base, trial_ends_at: '2026-12-24T12:00:00Z' }, now).tone, 'ok');
  const last = planSummary({ ...base, trial_ends_at: '2026-11-25T12:00:00Z' }, now);
  assert.equal(last.tone, 'warn'); assert.match(last.text, /queda 1 día/);
  assert.equal(planSummary({ ...base, source: 'subscription' }, now).tone, 'ok');
  const none = planSummary({ ...base, source: 'none' }, now);
  assert.equal(none.tone, 'danger'); assert.match(none.text, /Conservas todo/);
});
