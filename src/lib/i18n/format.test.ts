import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHeight, formatUsd, formatInt, feetInches } from './format.ts';

test('altura: castellano en metros con coma; inglés en pies y centímetros', () => {
  assert.equal(formatHeight(198, 'es'), '1,98 m');
  assert.equal(formatHeight(198, 'en'), '6′6″ (198 cm)');
  assert.equal(feetInches(183), '6′0″');
  assert.equal(formatHeight(null), null);
  assert.equal(formatHeight(0), null);
});

test('dólares: «18.000 US$» y «$18,000», con /año o /yr', () => {
  assert.equal(formatUsd(18000, 'es'), '18.000 US$');
  assert.equal(formatUsd(18000, 'es', { perYear: true }), '18.000 US$/año');
  assert.equal(formatUsd(18000, 'en', { perYear: true }), '$18,000/yr');
  assert.equal(formatUsd(null), null);
});

test('enteros con separador del idioma, también con 4 cifras', () => {
  assert.equal(formatInt(1200, 'es'), '1.200');
  assert.equal(formatInt(1200, 'en'), '1,200');
});
