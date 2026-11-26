import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveNcaaDivision, ncaaContactOpensOn, ncaaWindow, needsDivision, NIL_GO_THRESHOLD_USD, nilGoApplies, opportunityTypeAllowed } from './ncaa.ts';

test('misma fecha que la base de datos: 15 de junio tras el 2.º curso', () => {
  assert.equal(ncaaContactOpensOn(2030, 'ncaa_d1', 'basketball'), '2028-06-15');
  assert.equal(ncaaContactOpensOn(2030, 'ncaa_d2', 'soccer'), '2028-06-15');
  assert.equal(ncaaContactOpensOn(2030, 'ncaa_d1', 'baseball'), '2028-08-01');
  assert.equal(ncaaContactOpensOn(2030, 'ncaa_d1', 'lacrosse'), '2028-09-01');
  assert.equal(ncaaContactOpensOn(2030, 'ncaa_d3', 'basketball'), null);
  assert.equal(ncaaContactOpensOn(null, 'ncaa_d1', 'basketball'), null);
});

test('ventana abierta o cerrada según el día', () => {
  assert.deepEqual(ncaaWindow(2030, 'ncaa_d1', 'basketball', new Date('2026-11-16')), { open: false, opensOn: '2028-06-15' });
  assert.deepEqual(ncaaWindow(2027, 'ncaa_d1', 'basketball', new Date('2026-11-16')), { open: true, opensOn: '2025-06-15' });
  assert.deepEqual(ncaaWindow(2030, 'naia', 'basketball', new Date('2026-11-16')), { open: true, opensOn: null });
});

test('NIL Go: acuerdos de 600 $ o más con atletas D-I', () => {
  assert.equal(NIL_GO_THRESHOLD_USD, 600);
  assert.equal(nilGoApplies(600), true);
  assert.equal(nilGoApplies(599), false);
  assert.equal(nilGoApplies(null), false);
});

test('QA coach #3: universidad/college sin división → regla D-I (conservadora); clubes sin ventana', () => {
  assert.equal(needsDivision('university'), true);
  assert.equal(needsDivision('college'), true);
  assert.equal(needsDivision('club'), false);
  assert.equal(effectiveNcaaDivision('university', null), 'ncaa_d1');
  assert.equal(effectiveNcaaDivision('college', 'ncaa_d3'), 'ncaa_d3');
  assert.equal(effectiveNcaaDivision('club', 'ncaa_d1'), null);
  assert.deepEqual(ncaaWindow(2030, effectiveNcaaDivision('university', null), 'basketball', new Date('2026-11-16')), { open: false, opensOn: '2028-06-15' });
  assert.deepEqual(ncaaWindow(2030, effectiveNcaaDivision('club', null), 'basketball', new Date('2026-11-16')), { open: true, opensOn: null });
});

test('QA coach #13: una universidad/college no publica «tryout»; un club sí', () => {
  assert.equal(opportunityTypeAllowed('university', 'tryout'), false);
  assert.equal(opportunityTypeAllowed('college', 'tryout'), false);
  assert.equal(opportunityTypeAllowed('university', 'camp_showcase'), true);
  assert.equal(opportunityTypeAllowed('club', 'tryout'), true);
  assert.equal(opportunityTypeAllowed(undefined, 'tryout'), true);
});
