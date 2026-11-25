import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_COPY } from '../../app/onboarding/copy.ts';
import { navModeFor, localizeMode, flattenMode } from '../domain/navigation.ts';
import { ACTORS, ACTOR_EN } from '../domain/roles.ts';

/** Fase 4 (U2): ninguna pantalla traducida se queda a medias. */
test('el alta tiene las mismas claves en castellano e inglés', () => {
  assert.deepEqual(Object.keys(ONBOARDING_COPY.en).sort(), Object.keys(ONBOARDING_COPY.es).sort());
  assert.deepEqual(Object.keys(ONBOARDING_COPY.en.orgName).sort(), Object.keys(ONBOARDING_COPY.es.orgName).sort());
  assert.match(ONBOARDING_COPY.en.review('staff'), /scholarships/);
});

test('cada tipo de cuenta del alta tiene su texto en inglés', () => {
  for (const a of ACTORS) {
    assert.ok(ACTOR_EN[a.role]?.intent && ACTOR_EN[a.role]?.promise, a.role);
  }
});

test('la navegación de coach y universidad queda entera en inglés', () => {
  for (const [roles, clubStaff] of [[['coach'], true], [['coach'], false], [['university'], false]] as const) {
    const en = localizeMode(navModeFor({ roles: [...roles], primaryRole: roles[0], clubStaff }), 'en');
    const es = navModeFor({ roles: [...roles], primaryRole: roles[0], clubStaff });
    const esLabels = new Set(flattenMode(es).flatMap((i) => [i.label, i.desc]).filter(Boolean));
    const untranslated = flattenMode(en).flatMap((i) => [i.label, i.desc]).filter((v) => v && esLabels.has(v) && !['Gala IA', 'Showcase Day', 'Recruiting', 'College'].includes(v));
    assert.deepEqual(untranslated, [], `${roles[0]}${clubStaff ? ' (club)' : ''}`);
  }
});

test('en castellano la navegación no cambia', () => {
  const es = navModeFor({ roles: ['coach'], primaryRole: 'coach' });
  assert.deepEqual(localizeMode(es, 'es'), es);
});
