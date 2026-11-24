import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attestationLine } from './fee-attestation.ts';

test('con declaración: texto, fecha y versión; sin ella: aviso para pedirla', () => {
  const ok = attestationLine({ statement: 'Esta agencia declara que sus tarifas no dependen de la beca.', attestedAt: '2026-11-24T10:00:00Z', version: '2026-11' });
  assert.equal(ok.tone, 'ok');
  assert.equal(ok.text, 'Esta agencia declara que sus tarifas no dependen de la beca. Declarado el 24 de noviembre de 2026 (versión 2026-11).');
  assert.equal(attestationLine(null).tone, 'warn');
  assert.match(attestationLine(undefined).text, /Pídesela antes de autorizar/);
});

test('contador del cupo fundador: abierto, última plaza y agotado', async () => {
  const { founderSeats } = await import('./fee-attestation.ts');
  assert.deepEqual(founderSeats({ cap: 15, taken: 3, remaining: 12 }), { open: true, remaining: 12, text: 'Precio fundador −40 % de por vida: quedan 12 de 15 plazas.' });
  assert.equal(founderSeats({ cap: 15, taken: 14, remaining: 1 }).open, true);
  assert.equal(founderSeats({ cap: 15, taken: 15, remaining: 0 }).open, false);
  assert.match(founderSeats({ cap: 15, taken: 15, remaining: 0 }).text, /ocupadas/);
  assert.equal(founderSeats(null).open, false);
});
