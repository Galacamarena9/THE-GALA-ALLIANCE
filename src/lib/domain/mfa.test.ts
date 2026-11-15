import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mfaStep } from './mfa.ts';

test('doble factor: sin factor configurado se entra con normalidad (salvo administradores)', () => {
  assert.equal(mfaStep({ current: 'aal1', next: 'aal1', admin: false }), 'ok');
  assert.equal(mfaStep({ current: 'aal1', next: 'aal1', admin: true }), 'enroll');
});

test('doble factor: con factor configurado pero sin verificar en esta sesión, se pide el código', () => {
  assert.equal(mfaStep({ current: 'aal1', next: 'aal2', admin: false }), 'challenge');
  assert.equal(mfaStep({ current: 'aal1', next: 'aal2', admin: true }), 'challenge');
});

test('doble factor: sesión verificada con el código, se entra', () => {
  assert.equal(mfaStep({ current: 'aal2', next: 'aal2', admin: false }), 'ok');
  assert.equal(mfaStep({ current: 'aal2', next: 'aal2', admin: true }), 'ok');
});

test('doble factor: si no se puede leer el nivel, no se bloquea a nadie salvo a administradores', () => {
  assert.equal(mfaStep({ current: null, next: null, admin: false }), 'ok');
  assert.equal(mfaStep({ current: null, next: null, admin: true }), 'enroll');
});
