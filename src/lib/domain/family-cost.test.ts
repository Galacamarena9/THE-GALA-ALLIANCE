import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFit, familyCost, type CostScenario } from './family-cost.ts';

const base: CostScenario = {
  currency: 'USD', tuition: null, fees: null, housing: null, meals: null, insurance: null, travel: null, other_costs: null,
  athletic_aid: null, academic_aid: null, other_aid: null, housing_included: null,
};

test('sin matrícula no hay estimación: información insuficiente', () => {
  const r = familyCost({ ...base, housing: 11000 });
  assert.equal(r.status, 'insufficient');
  assert.match(r.headline, /Información insuficiente: falta la matrícula/);
});

test('faltan componentes esenciales: «coste conocido + X sin conocer», nunca «tu coste»', () => {
  const r = familyCost({ ...base, tuition: 30000, athletic_aid: 18000 });
  assert.equal(r.status, 'partial');
  assert.equal(r.knownNet, 12000);
  assert.deepEqual(r.missing.slice(0, 2), ['fees', 'housing']);
  assert.match(r.headline, /Coste conocido hasta ahora: 12\.000\sUS\$ \+ alojamiento, comidas sin conocer/);
});

test('alojamiento incluido no cuenta como desconocido; con lo esencial hay estimación', () => {
  const r = familyCost({ ...base, tuition: 27000, meals: 4000, housing_included: true, athletic_aid: 12000, academic_aid: 3000 });
  assert.equal(r.status, 'complete');
  assert.equal(r.knownNet, 16000);
  assert.ok(!r.missing.includes('housing'));
  assert.match(r.headline, /Coste estimado para la familia: 16\.000\sUS\$ al año \(sin tasas/);
});

test('la ayuda nunca deja un coste negativo', () => {
  assert.equal(familyCost({ ...base, tuition: 10000, housing: 0, meals: 0, athletic_aid: 15000 }).knownNet, 0);
});

test('presupuesto: solo «dentro» con datos completos y misma moneda; incompleto nunca se descarta', () => {
  const complete = familyCost({ ...base, tuition: 20000, housing: 5000, meals: 3000, athletic_aid: 15000 }); // 13.000
  assert.equal(budgetFit(complete, { amount: 15000, currency: 'USD' }), 'within');
  assert.equal(budgetFit(complete, { amount: 10000, currency: 'USD' }), 'over');
  assert.equal(budgetFit(complete, { amount: 15000, currency: 'EUR' }), 'unknown', 'otra moneda: sin conversión no se afirma');
  const partial = familyCost({ ...base, tuition: 20000, athletic_aid: 15000 });
  assert.equal(budgetFit(partial, { amount: 15000, currency: 'USD' }), 'unknown');
  assert.equal(budgetFit(partial, { amount: 1000, currency: 'USD' }), 'over', 'ya lo conocido supera el presupuesto');
  assert.equal(budgetFit(complete, null), 'unknown');
});
