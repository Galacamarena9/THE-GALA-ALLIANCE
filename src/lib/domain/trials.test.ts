import test from 'node:test';
import assert from 'node:assert/strict';
import { boardGroup, capacityLabel, eventWhen, knownRequiredCost, localToInstant, priceLabel, publishGapMessages, trialErrorMessage, trialFit, type CostComponent } from './trials.ts';

const c = (o: Partial<CostComponent>): CostComponent => ({ component_type: 'registration', label: 'Inscripción', amount: null, currency: null, required: true, included: false, ...o });

test('costes: «Gratis» solo si se declara; nunca 0 € ni gratis por omisión', () => {
  assert.equal(priceLabel('free', []), 'Gratis');
  assert.equal(priceLabel('price_not_provided', []), 'Coste sin indicar');
  assert.equal(priceLabel(null, []), 'Coste sin indicar');
  assert.equal(priceLabel('paid', []), 'De pago · importe incompleto');
  assert.match(priceLabel('paid', [c({ amount: 150, currency: 'EUR' })]), /150/);
});

test('costes: el total obligatorio conocido excluye lo opcional y lo incluido; si falta algo, no se inventa', () => {
  const academy = [c({ component_type: 'program_fee', amount: 8000, currency: 'EUR' }), c({ component_type: 'accommodation', amount: 4500, currency: 'EUR' }),
    c({ amount: 250, currency: 'EUR' }), c({ component_type: 'meals', included: true }), c({ component_type: 'transport', required: false })];
  assert.deepEqual(knownRequiredCost('paid', academy), { total: 12750, currency: 'EUR', reason: null });
  const trial = [c({ amount: 150, currency: 'EUR' }), c({ component_type: 'accommodation', amount: 80, currency: 'EUR', required: false })];
  assert.equal(knownRequiredCost('paid', trial).total, 150);
  assert.equal(knownRequiredCost('paid', [c({ amount: 150, currency: 'EUR' }), c({ component_type: 'insurance' })]).total, null);
  assert.equal(knownRequiredCost('paid', [c({ amount: 1, currency: 'EUR' }), c({ amount: 1, currency: 'USD' })]).reason, 'Los costes están en monedas distintas.');
});

test('plazas: libres derivadas de la capacidad confirmada; desconocida no es ilimitada', () => {
  assert.equal(capacityLabel(20, 15), '15 confirmadas · 5 libres');
  assert.equal(capacityLabel(null, 15), '15 confirmadas');
  assert.equal(capacityLabel(10, 12), '12 confirmadas · 0 libres');
});

test('fechas: la hora se muestra en la zona del evento; la conversión local → instante respeta el horario de verano', () => {
  const iso = localToInstant('2027-06-12', '10:00', 'Europe/Madrid');
  assert.equal(iso, '2027-06-12T08:00:00.000Z');
  assert.equal(eventWhen(iso, 'Europe/Madrid'), '12 jun 2027 · 10:00 (Europe/Madrid)');
  assert.equal(localToInstant('2027-01-12', '10:00', 'Europe/Madrid'), '2027-01-12T09:00:00.000Z');
  assert.equal(eventWhen(null, null), 'Fecha sin indicar');
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
  assert.equal(boardGroup({ status: 'sent' }), 'needs_athlete');
  assert.equal(boardGroup({ status: 'pending', needs_athlete_ok: true }), 'needs_athlete');
  assert.equal(boardGroup({ status: 'registered' }), 'waiting_club');
  assert.equal(boardGroup({ status: 'completed' }), 'after_event');
  assert.equal(boardGroup({ status: 'withdrawn' }), 'closed');
});

test('trials: errores y huecos de publicación se traducen a mensajes concretos', () => {
  assert.match(trialErrorMessage('organization_not_verified'), /verificadas/);
  assert.match(trialErrorMessage('xyz'), /No se ha podido/);
  assert.deepEqual(publishGapMessages('not_publishable:date,price'), ['Añade la fecha y la zona horaria antes de publicar.', 'Es de pago: indica el importe de la inscripción o de la cuota.']);
});
