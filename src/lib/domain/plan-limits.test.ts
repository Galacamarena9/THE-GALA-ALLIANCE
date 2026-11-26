import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutTrialDays, planBanner, planLimitMessage, planSummary, trialDaysLeft, usageLabel, usageRatio, type AgencyPlanStatus } from './plan-limits.ts';

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

test('checkout: nunca una prueba de Stripe encima de la de la app (máx. 30 días gratis en total)', () => {
  const trial = (ends: string | null): AgencyPlanStatus => ({ ...base, source: 'trial', trial_ends_at: ends });
  // Prueba en curso: solo los días que le quedan.
  assert.equal(checkoutTrialDays({ audience: 'agent', status: trial('2026-12-04T12:00:00Z'), hadSubscription: false, now }), 10);
  assert.equal(checkoutTrialDays({ audience: 'agent', status: trial('2026-12-24T12:00:00Z'), hadSubscription: false, now }), 30);
  // Prueba terminada: 0 (antes se daban otros 30).
  assert.equal(checkoutTrialDays({ audience: 'agent', status: { ...base, source: 'none', plan_code: null, trial_ends_at: '2026-11-01T00:00:00Z', athletes_limit: 0 }, hadSubscription: false, now }), 0);
  // Ya tuvo suscripción (canceló y vuelve): 0 aunque la fecha de prueba siguiera en el futuro.
  assert.equal(checkoutTrialDays({ audience: 'agent', status: trial('2026-12-04T12:00:00Z'), hadSubscription: true, now }), 0);
  // Suscripción activa, sin estado o no es una agencia: 0.
  assert.equal(checkoutTrialDays({ audience: 'agent', status: { ...base, source: 'subscription' }, hadSubscription: false, now }), 0);
  assert.equal(checkoutTrialDays({ audience: 'agent', status: null, hadSubscription: false, now }), 0);
  assert.equal(checkoutTrialDays({ audience: 'organization', status: trial('2026-12-04T12:00:00Z'), hadSubscription: false, now }), 0);
});

test('aviso de plan en Hoy y Mis atletas: prueba, últimos 5 días, sin plan y cerca del límite', () => {
  assert.equal(planBanner(null, now), null);
  assert.deepEqual(planBanner({ ...base, trial_ends_at: '2026-12-14T12:00:00Z' }, now), { tone: 'neutral', kind: 'trial', daysLeft: 20, used: 3, limit: 100 });
  assert.deepEqual(planBanner({ ...base, trial_ends_at: '2026-11-29T12:00:00Z' }, now), { tone: 'warn', kind: 'trial_ending', daysLeft: 5, used: 3, limit: 100 });
  assert.equal(planBanner({ ...base, trial_ends_at: '2026-11-30T12:00:00Z' }, now)?.kind, 'trial');
  assert.equal(planBanner({ ...base, trial_ends_at: '2026-12-14T12:00:00Z', athletes_used: 100 }, now)?.tone, 'warn');
  assert.equal(planBanner({ ...base, source: 'none', athletes_limit: 0 }, now)?.kind, 'ended');
  const sub: AgencyPlanStatus = { ...base, source: 'subscription', plan_code: 'agent_solo', athletes_limit: 25 };
  assert.equal(planBanner({ ...sub, athletes_used: 19 }, now), null);
  assert.equal(planBanner({ ...sub, athletes_used: 20 }, now)?.kind, 'limit_near');
  assert.equal(planBanner({ ...sub, athletes_used: 25 }, now)?.kind, 'limit_full');
  assert.equal(planBanner({ ...sub, athletes_limit: -1, athletes_used: 500 }, now), null);
});
