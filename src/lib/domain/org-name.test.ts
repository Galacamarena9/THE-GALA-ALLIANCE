import test from 'node:test';
import assert from 'node:assert/strict';
import { orgNameKey } from './org-name.ts';

test('organizaciones: variantes del mismo nombre comparten clave (no se duplican)', () => {
  const k = orgNameKey('Valencia Basket');
  for (const v of ['VALENCIA BASKET', 'Valencia Basket Club', 'ValenciaBasket', '  valencia   basket ', 'Valencia Basket S.A.D.']) assert.equal(orgNameKey(v), k, v);
  assert.equal(orgNameKey('Atlético de Madrid'), orgNameKey('Atletico Madrid'));
  assert.notEqual(orgNameKey('Valencia Basket'), orgNameKey('Valencia CF'), 'sección distinta, entidad distinta');
  assert.notEqual(orgNameKey('Valencia CF'), orgNameKey('CB Valencia Academy'), 'CF/CB/Academy distinguen entidades');
  assert.equal(orgNameKey('Club'), null, 'solo palabras genéricas no es un nombre');
});
