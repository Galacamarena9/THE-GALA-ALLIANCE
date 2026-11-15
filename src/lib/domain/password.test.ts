import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNewPassword, passwordStrength } from './password.ts';

test('contraseña nueva: mínimo 10, máximo 72 y las dos deben coincidir', () => {
  assert.deepEqual(checkNewPassword('corta', 'corta'), { ok: false, error: 'Mínimo 10 caracteres' });
  assert.deepEqual(checkNewPassword('x'.repeat(73), 'x'.repeat(73)), { ok: false, error: 'Máximo 72 caracteres' });
  assert.deepEqual(checkNewPassword('canasta-de-tres-2027', 'canasta-de-tres-2028'), { ok: false, error: 'Las contraseñas no coinciden' });
  assert.deepEqual(checkNewPassword('canasta-de-tres-2027', 'canasta-de-tres-2027'), { ok: true });
});

test('contraseña nueva: rechaza las más usadas aunque sean largas', () => {
  assert.deepEqual(checkNewPassword('1234567890', '1234567890'), { ok: false, error: 'Esa contraseña es demasiado común' });
  assert.deepEqual(checkNewPassword('Password123', 'Password123'), { ok: false, error: 'Esa contraseña es demasiado común' });
  assert.deepEqual(checkNewPassword('aaaaaaaaaaaa', 'aaaaaaaaaaaa'), { ok: false, error: 'Esa contraseña es demasiado común' });
});

test('fortaleza: de 0 (muy débil) a 4 (muy fuerte)', () => {
  assert.equal(passwordStrength(''), 0);
  assert.equal(passwordStrength('aaaaaaaaaa'), 0);
  assert.equal(passwordStrength('baloncesto'), 1);
  assert.equal(passwordStrength('Baloncesto2027'), 2);
  assert.equal(passwordStrength('Baloncesto-2027!'), 3);
  assert.equal(passwordStrength('mi-triple-favorito-en-la-NCAA-2027'), 4);
});
