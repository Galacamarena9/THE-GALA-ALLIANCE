import { test } from 'node:test';
import assert from 'node:assert/strict';
import { athleteCanRemoveGuardian, familyPaysPlan, isGuardianChangeError, paysThroughFamily, FAMILY_ASK_HREF } from './minor-guard.ts';

test('un atleta menor paga a través de su familia; un adulto, una familia o una organización no', () => {
  assert.equal(paysThroughFamily({ isMinor: true, roles: ['athlete'] }), true);
  assert.equal(paysThroughFamily({ isMinor: false, roles: ['athlete'] }), false);
  assert.equal(paysThroughFamily({ isMinor: false, roles: ['parent'] }), false);
  // Sin fecha de nacimiento se trata como menor, pero una agencia sin rol de atleta sigue pudiendo pagar.
  assert.equal(paysThroughFamily({ isMinor: true, roles: ['agent'] }), false);
});

test('solo los planes de atleta/familia cambian el CTA; los de organización no aplican a un menor', () => {
  const kid = { isMinor: true, roles: ['athlete'] };
  assert.equal(familyPaysPlan(kid, 'family'), true);
  assert.equal(familyPaysPlan(kid, 'athlete'), true);
  assert.equal(familyPaysPlan(kid, 'agent'), false);
  assert.equal(familyPaysPlan({ isMinor: false, roles: ['athlete'] }, 'family'), false);
  assert.equal(FAMILY_ASK_HREF, '/app/settings#familia');
});

test('un menor no quita a su tutor activo (aprobado o en pausa); un adulto sí; una invitación pendiente sí se retira', () => {
  assert.equal(athleteCanRemoveGuardian({ athleteIsMinor: true, linkStatus: 'approved' }), false);
  assert.equal(athleteCanRemoveGuardian({ athleteIsMinor: true, linkStatus: 'restricted' }), false);
  assert.equal(athleteCanRemoveGuardian({ athleteIsMinor: true, linkStatus: 'pending' }), true);
  assert.equal(athleteCanRemoveGuardian({ athleteIsMinor: false, linkStatus: 'approved' }), true);
});

test('reconoce el error de la base de datos', () => {
  assert.equal(isGuardianChangeError('ERROR: guardian_change_requires_guardian'), true);
  assert.equal(isGuardianChangeError('permission denied'), false);
  assert.equal(isGuardianChangeError(null), false);
});
