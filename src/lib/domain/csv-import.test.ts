import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseContactsCsv, CONTACT_IMPORT_MAX } from './csv-import.ts';

test('parseCsv: comillas, comas y saltos dentro de comillas, BOM y CRLF', () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","di ""hola""","l1\nl2"\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'di "hola"', 'l1\nl2']]);
});

test('parseCsv detecta punto y coma (Excel en español)', () => {
  assert.deepEqual(parseCsv('a;b\n1;2\n'), [['a', 'b'], ['1', '2']]);
});

test('parseContactsCsv reconoce cabeceras en español e inglés', () => {
  const r = parseContactsCsv('Universidad;Nombre;Cargo;Email;Teléfono\nUniv. Example;Ana Ruiz;Assistant Coach;ana@example.edu;+1 555\n');
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.rows[0], { institution_name: 'Univ. Example', name: 'Ana Ruiz', role_title: 'Assistant Coach', email: 'ana@example.edu', phone: '+1 555', notes: null });
  const en = parseContactsCsv('school,coach name,title,e-mail\nX College,Bo Lee,Head Coach,bo@x.edu\n');
  assert.equal(en.rows[0].name, 'Bo Lee');
  assert.equal(en.rows[0].institution_name, 'X College');
});

test('parseContactsCsv explica qué falta y salta filas malas sin perder las buenas', () => {
  const r = parseContactsCsv('Universidad,Nombre,Email\nA Univ,Ana,ana@a.edu\n,Sin uni,\nB Univ,Bea,no-es-email\n');
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.errors.map((e) => e.line), [3, 4]);
  assert.match(r.errors[0].message, /universidad/i);
  assert.match(r.errors[1].message, /email/i);
});

test('parseContactsCsv exige columnas de universidad y nombre', () => {
  const r = parseContactsCsv('foo,bar\n1,2\n');
  assert.equal(r.rows.length, 0);
  assert.match(r.fatal ?? '', /Universidad.*Nombre/);
});

test('parseContactsCsv limita el número de filas', () => {
  const body = Array.from({ length: CONTACT_IMPORT_MAX + 5 }, (_, i) => `U${i},N${i}`).join('\n');
  const r = parseContactsCsv(`Universidad,Nombre\n${body}\n`);
  assert.equal(r.rows.length, CONTACT_IMPORT_MAX);
  assert.match(r.fatal ?? '', /500/);
});
