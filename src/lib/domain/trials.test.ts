import test from 'node:test';
import assert from 'node:assert/strict';
import { boardGroup, eventWhen, feeLabel, trialErrorMessage, trialFit } from './trials.ts';

test('trials: el coste siempre se muestra claro', () => {
  assert.equal(feeLabel({ fee_type: 'free', fee_amount: null, currency: null }), 'Gratis');
  assert.equal(feeLabel({ fee_type: 'unknown', fee_amount: null, currency: null }), 'Coste sin indicar');
  assert.match(feeLabel({ fee_type: 'paid', fee_amount: 50, currency: 'EUR' }), /50/);
  assert.equal(feeLabel(null), 'Coste sin indicar');
});

test('trials: la hora se muestra en la zona del evento, sin convertir', () => {
  assert.equal(eventWhen({ event_start_date: '2027-06-12', start_time_local: '10:00:00', timezone: 'Europe/Madrid' }), '12 jun 2027 · 10:00 (Europe/Madrid)');
  assert.equal(eventWhen(null), 'Fecha sin indicar');
});

test('trials: encaje para el agente — deporte obligatorio; posición y promoción solo si se piden', () => {
  const a = { id: 'a', sport_id: 'basketball', primary_position_id: 1, graduation_year: 2027 };
  assert.equal(trialFit(a, { sport_id: 'football', position_ids: [], graduation_years: [] }).ok, false);
  assert.deepEqual(trialFit(a, { sport_id: 'basketball', position_ids: [1, 2], graduation_years: [2027] }).reasons, ['Deporte', 'Posición', 'Promoción']);
  assert.equal(trialFit(a, { sport_id: 'basketball', position_ids: [5], graduation_years: [] }).ok, false);
  const noPos = trialFit({ ...a, primary_position_id: null }, { sport_id: 'basketball', position_ids: [1], graduation_years: [] });
  assert.equal(noPos.ok, true);
  assert.deepEqual(noPos.missing, ['Posición sin indicar']);
});

test('trials: el tablero del agente pone primero lo que espera al atleta', () => {
  assert.equal(boardGroup({ status: 'interested', needs_athlete_ok: true, guardian_status: 'not_required' }), 'needs_athlete');
  assert.equal(boardGroup({ status: 'registered', needs_athlete_ok: false, guardian_status: 'not_required' }), 'waiting_club');
  assert.equal(boardGroup({ status: 'attended', needs_athlete_ok: false, guardian_status: 'not_required' }), 'after_event');
  assert.equal(boardGroup({ status: 'withdrawn', needs_athlete_ok: false, guardian_status: 'not_required' }), 'closed');
});

test('trials: los errores de la base de datos se traducen', () => {
  assert.match(trialErrorMessage('organization_not_verified'), /verificadas/);
  assert.equal(trialErrorMessage('xyz'), 'No se ha podido completar la acción.');
});
