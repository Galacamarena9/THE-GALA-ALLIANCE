import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFit, convert, dual, familyCost, fourYearLine, money, validFx, type CostScenario } from './family-cost.ts';

const base: CostScenario = {
  currency: 'USD', tuition: null, fees: null, housing: null, meals: null, insurance: null, travel: null, other_costs: null,
  athletic_aid: null, academic_aid: null, other_aid: null, housing_included: null,
};
const fx = { eurPerUsd: 0.9, date: '2026-11-27', source: 'BCE (tipo de referencia)' };

test('sin matrícula no hay estimación: información insuficiente', () => {
  const r = familyCost({ ...base, housing: 11000 });
  assert.equal(r.status, 'insufficient');
  assert.match(r.headline, /Información insuficiente: falta la matrícula/);
});

test('faltan datos: «coste mínimo conocido» y se listan TODOS los huecos (también tasas, seguro, viajes y otros)', () => {
  const r = familyCost({ ...base, tuition: 30000, athletic_aid: 18000 });
  assert.equal(r.status, 'partial');
  assert.equal(r.knownNet, 12000);
  assert.deepEqual(r.missing, ['fees', 'housing', 'meals', 'insurance', 'travel', 'other_costs']);
  assert.match(r.headline, /Coste mínimo conocido: 12\.000\sUS\$ al año \(sin dato: tasas, alojamiento, comidas, seguro médico, viajes \(estimado\), otros costes\)/);
});

test('seguro médico y viajes son esenciales: sin ellos no hay «coste estimado»', () => {
  const sinSeguro = familyCost({ ...base, tuition: 27000, meals: 4000, housing_included: true, travel: 1500 });
  assert.equal(sinSeguro.status, 'partial');
  assert.ok(sinSeguro.missing.includes('insurance'));
  const sinViajes = familyCost({ ...base, tuition: 27000, meals: 4000, housing_included: true, insurance: 2000 });
  assert.equal(sinViajes.status, 'partial');
});

test('alojamiento incluido no cuenta como sin dato; con lo esencial hay estimación', () => {
  const r = familyCost({ ...base, tuition: 27000, meals: 4000, housing_included: true, insurance: 2000, travel: 1500, athletic_aid: 12000, academic_aid: 3000 });
  assert.equal(r.status, 'complete');
  assert.equal(r.knownNet, 19500);
  assert.equal(r.fourYearNet, 78000);
  assert.ok(!r.missing.includes('housing'));
  assert.match(r.headline, /Coste estimado para la familia: 19\.500\sUS\$ al año \(sin dato: tasas, otros costes\)/);
});

test('la ayuda nunca deja un coste negativo', () => {
  assert.equal(familyCost({ ...base, tuition: 10000, housing: 0, meals: 0, athletic_aid: 15000 }).knownNet, 0);
});

test('dinero: miles agrupados también con 4 cifras y sin céntimos', () => {
  assert.match(money(1200, 'USD'), /^1\.200\sUS\$$/);
  assert.match(money(8000, 'EUR'), /^8\.000\s€$/);
  assert.equal(money(1200, 'USD', 'en'), '$1,200');
});

test('tipo de cambio: sin tipo (o incompleto) no se convierte nada; con tipo, USD ↔ EUR', () => {
  assert.equal(convert(1000, 'USD', 'EUR', null), null);
  assert.equal(validFx({ eurPerUsd: 0.9, date: '2026-11-27', source: '' }), false, 'sin fuente no vale');
  assert.equal(validFx({ eurPerUsd: 0, date: '2026-11-27', source: 'BCE' }), false, 'tipo 0 no vale');
  assert.equal(convert(1000, 'USD', 'EUR', fx), 900);
  assert.equal(convert(900, 'EUR', 'USD', fx), 1000);
  assert.equal(convert(1000, 'GBP', 'USD', fx), null, 'libras: sin tipo documentado');
  assert.equal(dual(1000, 'USD', null).secondary, null, 'por defecto solo USD');
  assert.match(dual(1000, 'USD', fx).secondary ?? '', /900\s€/);
});

test('a 4 años: completo «A 4 años», incompleto «al menos», insuficiente nada', () => {
  const complete = familyCost({ ...base, tuition: 20000, housing: 5000, meals: 3000, insurance: 1500, travel: 1500, athletic_aid: 15000 });
  assert.match(fourYearLine(complete, null) ?? '', /^A 4 años: 64\.000\sUS\$$/);
  assert.match(fourYearLine(complete, fx) ?? '', /^A 4 años: 64\.000\sUS\$ \(≈ 57\.600\s€\)$/);
  const partial = familyCost({ ...base, tuition: 20000 });
  assert.match(fourYearLine(partial, null) ?? '', /al menos 80\.000/);
  assert.equal(fourYearLine(familyCost({ ...base, housing: 1 }), null), null);
});

test('presupuesto: solo «dentro» con datos completos; otra moneda solo con tipo de cambio; incompleto nunca se descarta', () => {
  const complete = familyCost({ ...base, tuition: 20000, housing: 5000, meals: 3000, insurance: 1000, travel: 1000, athletic_aid: 17000 }); // 13.000
  assert.equal(budgetFit(complete, { amount: 15000, currency: 'USD' }), 'within');
  assert.equal(budgetFit(complete, { amount: 10000, currency: 'USD' }), 'over');
  const eur = familyCost({ ...complete, currency: 'EUR', tuition: 20000, housing: 5000, meals: 3000, insurance: 1000, travel: 1000, fees: null, other_costs: null,
    athletic_aid: 17000, academic_aid: null, other_aid: null, housing_included: null } as CostScenario); // 13.000 €
  assert.equal(budgetFit(eur, { amount: 15000, currency: 'USD' }), 'unknown', 'otra moneda: sin conversión no se afirma');
  assert.equal(budgetFit(eur, { amount: 15000, currency: 'USD' }, fx), 'within', '13.000 € ≈ 14.444 US$');
  assert.equal(budgetFit(eur, { amount: 14000, currency: 'USD' }, fx), 'over');
  const partial = familyCost({ ...base, tuition: 20000, athletic_aid: 15000 });
  assert.equal(budgetFit(partial, { amount: 15000, currency: 'USD' }), 'unknown');
  assert.equal(budgetFit(partial, { amount: 1000, currency: 'USD' }), 'over', 'ya lo conocido supera el presupuesto');
  assert.equal(budgetFit(complete, null), 'unknown');
});

test('en inglés el titular también es honesto', () => {
  const r = familyCost({ ...base, tuition: 30000 }, 'en');
  assert.match(r.headline, /^Minimum known cost: \$30,000 a year \(no data yet: fees, housing/);
});
