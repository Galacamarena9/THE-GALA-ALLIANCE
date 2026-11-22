import { test } from 'node:test';
import assert from 'node:assert/strict';
import { log, redact } from './log.ts';

test('19 · los logs nunca llevan emails, teléfonos, claves ni tokens', () => {
  const r = redact('fallo para ana@club.es (+34 600 123 456) con sk_live_abcdefghijk y eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij');
  assert.doesNotMatch(r, /ana@club\.es/);
  assert.doesNotMatch(r, /600 123/);
  assert.doesNotMatch(r, /sk_live/);
  assert.match(r, /\[email\].*\[phone\].*\[secret\].*\[jwt\]/);
});

test('19 · solo se registran campos conocidos; el resto se omite', () => {
  const orig = console.log; let line = '';
  console.log = (s: string) => { line = s; };
  try { log('info', 'test', { route: '/app', user: { email: 'x@y.z' }, durationMs: 12 }); } finally { console.log = orig; }
  const o = JSON.parse(line);
  assert.equal(o.route, '/app'); assert.equal(o.durationMs, 12); assert.equal(o.user, '[omitted]');
});
