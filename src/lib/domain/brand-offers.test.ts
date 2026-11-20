import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCompensation, exclusivitySummary, usageSummary } from './brand-offers.ts';

test('13 · producto no es dinero: «solo producto» con su valor y 0 en dinero', () => {
  const s = describeCompensation([{ kind: 'product', amount: 350, currency: 'EUR', guaranteed: true, description: 'Dos pares' }]);
  assert.equal(s.productOnly, true);
  assert.match(s.headline, /^Solo producto \(valor 350/);
  assert.match(s.headline, /0 en dinero/);
  assert.deepEqual(s.guaranteedCash, []);
});

test('13 · un bonus condicionado no cuenta como dinero garantizado', () => {
  const s = describeCompensation([
    { kind: 'cash', amount: 500, currency: 'USD', guaranteed: true, description: 'Fijo' },
    { kind: 'performance_bonus', amount: 200, currency: 'USD', guaranteed: false, description: '10k vistas' },
  ]);
  assert.deepEqual(s.guaranteedCash, [{ currency: 'USD', amount: 500 }]);
  assert.match(s.lines[1], /condicionado/);
  const onlyBonus = describeCompensation([{ kind: 'performance_bonus', amount: 200, currency: 'USD', guaranteed: false, description: 'x' }]);
  assert.equal(onlyBonus.headline, 'Sin dinero garantizado: solo condicionado');
});

test('13 · «no especificado» se dice tal cual', () => {
  assert.match(describeCompensation([], true).headline, /no especificada/);
});

test('13 · derechos de uso y exclusividad explícitos', () => {
  assert.equal(usageSummary({ usage_months: 0, usage_channels: [], usage_territory: 'WORLD', organic_use: true, paid_media: false }), 'Sin derechos de uso posteriores');
  assert.match(usageSummary({ usage_months: 6, usage_channels: ['instagram'], usage_territory: 'WORLD', organic_use: true, paid_media: true }), /6 meses · instagram · todo el mundo · orgánico y publicidad pagada/);
  assert.equal(exclusivitySummary({ exclusivity_category: null, exclusivity_days: 0 }), 'Sin exclusividad');
  assert.match(exclusivitySummary({ exclusivity_category: 'Calzado', exclusivity_days: 90 }), /Calzado.*90 días/);
});
