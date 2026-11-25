import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLocale, isLocale, pick } from './locale.ts';

test('la cookie elegida manda sobre el navegador', () => {
  assert.equal(pickLocale('en', 'es-ES,es;q=0.9'), 'en');
  assert.equal(pickLocale('es', 'en-US,en;q=0.9'), 'es');
});

test('sin cookie: el primer idioma soportado del navegador, respetando q', () => {
  assert.equal(pickLocale(null, 'en-US,en;q=0.9,es;q=0.8'), 'en');
  assert.equal(pickLocale(undefined, 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7'), 'en');
  assert.equal(pickLocale(null, 'es;q=0.5,en;q=0.9'), 'en');
  assert.equal(pickLocale(null, 'ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7'), 'es');
  assert.equal(pickLocale(null, 'en;q=0,es'), 'es');
});

test('sin datos o con basura: castellano', () => {
  assert.equal(pickLocale(null, null), 'es');
  assert.equal(pickLocale('fr', 'de-DE'), 'es');
  assert.equal(pickLocale('', ';;,,q=abc'), 'es');
  assert.equal(isLocale('EN'), false);
});

test('pick devuelve el idioma pedido', () => {
  assert.equal(pick({ es: 'Hola', en: 'Hello' }, 'en'), 'Hello');
});
