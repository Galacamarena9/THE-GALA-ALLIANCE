import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteMessage, parsePortfolioCsv } from './portfolio-import.ts';

test('lee nombres, emails, deporte y promoción con títulos en español y separador ;', () => {
  const r = parsePortfolioCsv('Nombre;Email;Deporte;Promoción\nLucía Marín;LUCIA@x.com;Baloncesto;2027\nPablo Ruiz;;Fútbol;\n', 2026);
  assert.equal(r.fatal, undefined);
  assert.deepEqual(r.rows, [
    { full_name: 'Lucía Marín', email: 'lucia@x.com', sport: 'Baloncesto', graduation_year: 2027 },
    { full_name: 'Pablo Ruiz', email: null, sport: 'Fútbol', graduation_year: null },
  ]);
});

test('errores por línea: sin nombre, email malo, año raro y repetidos', () => {
  const r = parsePortfolioCsv('name,email,class of\n,a@b.com,2027\nAna,no-es-email,2027\nEva,,1999\nIris,i@x.com,2028\nIris,i@x.com,2028\n', 2026);
  assert.deepEqual(r.errors.map((e) => e.line), [2, 3, 4, 6]);
  assert.equal(r.rows.length, 1);
});

test('sin columna de nombre es un error claro', () => {
  assert.match(parsePortfolioCsv('email\na@b.com').fatal ?? '', /Nombre/);
});

test('el mensaje de invitación no habla de representar', () => {
  const m = inviteMessage({ athleteFirstName: 'Lucía', agencyName: 'Norte', link: 'https://x/y' });
  assert.match(m, /https:\/\/x\/y/);
  assert.doesNotMatch(m, /represent/i);
});
