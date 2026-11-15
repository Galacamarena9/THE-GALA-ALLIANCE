import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sportTone, SPORT_TONE_CLASS } from './sport-tone.ts';

test('color por deporte: reconoce nombres en español e inglés, con o sin tildes', () => {
  assert.equal(sportTone('Baloncesto'), 'basketball');
  assert.equal(sportTone('Basketball'), 'basketball');
  assert.equal(sportTone('Fútbol'), 'football');
  assert.equal(sportTone('futbol'), 'football');
  assert.equal(sportTone('Soccer'), 'football');
  assert.equal(sportTone('Voleibol'), 'volleyball');
  assert.equal(sportTone('Vóley playa'), 'volleyball');
  assert.equal(sportTone('Beach volleyball'), 'volleyball');
  assert.equal(sportTone('Tenis'), 'tennis');
  assert.equal(sportTone('Track & Field'), 'athletics');
  assert.equal(sportTone('Atletismo'), 'athletics');
  assert.equal(sportTone('Natación'), 'swimming');
  assert.equal(sportTone('Swimming & Diving'), 'swimming');
});

test('color por deporte: el fútbol americano y los deportes sin color propio usan el de marca', () => {
  assert.equal(sportTone('American football'), 'other');
  assert.equal(sportTone('Fútbol americano'), 'other');
  assert.equal(sportTone('Golf'), 'other');
  assert.equal(sportTone(''), 'other');
  assert.equal(sportTone(null), 'other');
  assert.equal(sportTone(undefined), 'other');
});

test('color por deporte: cada tono tiene una clase de Tailwind literal (para que el compilador la genere)', () => {
  for (const tone of ['basketball', 'football', 'volleyball', 'tennis', 'athletics', 'swimming', 'other'] as const) {
    assert.match(SPORT_TONE_CLASS[tone], new RegExp(`^bg-sport-${tone} text-white$`));
  }
});
