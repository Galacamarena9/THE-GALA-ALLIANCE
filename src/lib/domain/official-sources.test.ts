import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIBA_EUROPE_FEDERATIONS } from '../../content/official-sources.ts';
import { classifyOfficialLink, federationFor, officialSearchLinks } from './official-sources.ts';

test('registro: 50 federaciones de FIBA Europa, códigos únicos y página oficial en FIBA', () => {
  assert.equal(FIBA_EUROPE_FEDERATIONS.length, 50);
  assert.equal(new Set(FIBA_EUROPE_FEDERATIONS.map((f) => f.iso2)).size, 50);
  assert.ok(FIBA_EUROPE_FEDERATIONS.every((f) => f.fibaPage.startsWith('https://about.fiba.basketball/en/regions/europe/national-federations/')));
  assert.equal(federationFor('es')?.website, 'https://www.feb.es');
  assert.equal(federationFor('XX'), null);
});

test('reconoce fichas y páginas oficiales, y no se deja engañar por dominios parecidos', () => {
  assert.deepEqual(classifyOfficialLink('https://www.fiba.basketball/en/players/269669-josh-giddey'), { source: 'fiba', sourceName: 'FIBA', kind: 'player_profile', country: null, label: 'Ficha en FIBA' });
  assert.equal(classifyOfficialLink('https://stats.ncaa.org/teams/123')?.kind, 'stats');
  assert.equal(classifyOfficialLink('https://www.espn.com/mens-college-basketball/player/_/id/1/x')?.kind, 'player_profile');
  assert.equal(classifyOfficialLink('https://baloncestoenvivo.feb.es/jugador/1')?.source, 'federation');
  assert.equal(classifyOfficialLink('https://www.feb.es/x')?.country, 'ES');
  for (const fake of ['https://fiba.basketball.evil.test/en/players/1', 'https://notfiba.basketball/en/players/1', 'https://feb.es.example.com', 'javascript:alert(1)', 'nada']) {
    assert.equal(classifyOfficialLink(fake), null, fake);
  }
});

test('búsquedas: primero la federación del país, nombre entrecomillado y codificado', () => {
  const s = officialSearchLinks({ name: '  Ana  Pérez ', country: 'ES', sport: 'basketball' });
  assert.deepEqual(s.map((x) => x.id), ['federation', 'fiba', 'ncaa', 'espn', 'euroleague']);
  assert.ok(s[0].href.includes(encodeURIComponent('site:feb.es "Ana Pérez"')));
  assert.equal(officialSearchLinks({ name: 'Ana', country: 'LT', sport: 'basketball' })[0].href, 'https://about.fiba.basketball/en/regions/europe/national-federations/611-lithuania');
  assert.equal(officialSearchLinks({ name: 'A' }).length, 0);
  assert.equal(officialSearchLinks({ name: 'Ana', country: null, sport: 'basketball' })[0].id, 'fiba');
});

test('fuera del baloncesto no salen FIBA, EuroLeague ni la federación de baloncesto del país', () => {
  assert.deepEqual(officialSearchLinks({ name: 'Nora Costa', country: 'PT', sport: 'tennis' }).map((x) => x.id), ['ncaa', 'espn']);
  assert.deepEqual(officialSearchLinks({ name: 'Nora Costa', country: 'PT', sport: null }).map((x) => x.id), ['ncaa', 'espn']);
  assert.deepEqual(officialSearchLinks({ name: 'Nora Costa', country: 'PT', sport: 'basketball' }).map((x) => x.id), ['federation', 'fiba', 'ncaa', 'espn', 'euroleague']);
});
