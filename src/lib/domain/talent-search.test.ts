import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeChips, englishAtLeast, parseSort, parseTalentFilters, talentHref } from './talent-search.ts';

test('filtros válidos pasan normalizados; los inválidos se ignoran', () => {
  const f = parseTalentFilters({
    sport: 'football', position: '12', nationality: 'es', country: 'XX1', min_height: '185', max_height: '999',
    side: 'left', english: 'b2', verified: '1', video: 'yes', gpa: '5.5', exp_min: '4', q: "Ana%_' or 1=1",
  }, ['ncaa_d1']);
  assert.equal(f.sport, 'football');
  assert.equal(f.position, '12');
  assert.equal(f.nationality, 'ES', 'ISO en mayúsculas');
  assert.equal(f.country, undefined, 'país inválido');
  assert.equal(f.min_height, '185');
  assert.equal(f.max_height, undefined, 'fuera de rango');
  assert.equal(f.side, 'left');
  assert.equal(f.english, 'b2');
  assert.equal(f.verified, '1');
  assert.equal(f.video, undefined, 'solo «1» activa vídeo');
  assert.equal(f.gpa, undefined, 'GPA > 4 no');
  assert.equal(f.exp_min, '4');
  assert.doesNotMatch(f.q ?? '', /[%_,()]/, 'sin comodines ni sintaxis de filtro');
});

test('claves desconocidas y divisiones no permitidas fuera', () => {
  const f = parseTalentFilters({ division: 'liga_inventada', budget: '1000', email: 'x@y.z' }, ['ncaa_d1']);
  assert.deepEqual(f, {});
});

test('rangos al revés se corrigen en lugar de dar cero resultados', () => {
  const f = parseTalentFilters({ min_height: '200', max_height: '180', grad_min: '2029', grad_max: '2027' });
  assert.equal(f.min_height, '180'); assert.equal(f.max_height, '200');
  assert.equal(f.grad_min, '2027'); assert.equal(f.grad_max, '2029');
});

test('inglés «B2 o más» incluye los niveles superiores', () => {
  assert.deepEqual(englishAtLeast('b2'), ['b2', 'c1', 'c2', 'native']);
  assert.deepEqual(englishAtLeast('zz'), []);
});

test('orden por defecto: actualizados recientemente', () => {
  assert.equal(parseSort('height'), 'height');
  assert.equal(parseSort('drop table'), 'recent');
  assert.equal(parseSort(undefined), 'recent');
});

test('cada filtro activo se ve en claro y se quita de uno en uno', () => {
  const chips = activeChips(
    { sport: 'basketball', position: '3', min_height: '190', nationality: 'FR', english: 'c1', verified: '1' },
    { sportName: () => 'Baloncesto', positionName: () => 'Base', countryName: () => 'Francia' },
  );
  const labels = chips.map((c) => c.label);
  assert.ok(labels.includes('Baloncesto'));
  assert.ok(labels.includes('Base'));
  assert.ok(labels.includes('Altura ≥ 190 cm'));
  assert.ok(labels.includes('Nacionalidad: Francia'));
  assert.ok(labels.includes('Inglés C1+'));
  // Quitar el deporte quita también la posición (dejaría de tener sentido).
  assert.deepEqual(chips.find((c) => c.key === 'sport')?.remove, ['sport', 'position']);
});

test('los enlaces conservan filtros, vuelven a la página 1 y quitan lo vacío', () => {
  const url = talentHref('/app/discover', { sport: 'football', page: '3', side: 'left' }, { side: undefined });
  assert.equal(url, '/app/discover?sport=football');
  assert.equal(talentHref('/app/discover', { page: '2' }, { page: '3' }), '/app/discover?page=3');
  assert.equal(talentHref('/app/discover', {}, {}), '/app/discover');
});
