import test from 'node:test';
import assert from 'node:assert/strict';
import { accessLevel, checks, REQUEST_STATUS_TEXT } from './verification.ts';

const base = { email_verified: true, organization_verified: true, affiliation_verified: true, program_verified: false, role_verified: false, access_active: true };

test('verificación: «Coach verificado» solo cuando organización, afiliación y cargo están verificados', () => {
  assert.equal(accessLevel(base).key, 'limited');
  assert.equal(accessLevel({ ...base, role_verified: true }).key, 'full');
  assert.equal(accessLevel(null).key, 'none');
  assert.equal(accessLevel({ ...base, access_active: false, role_verified: true }).key, 'none');
});

test('verificación: el correo confirmado no se presenta como verificación completa', () => {
  const c = checks({ ...base, affiliation_verified: false, access_active: false });
  assert.equal(c.find((x) => x.label === 'Correo institucional')?.state, 'done');
  assert.notEqual(c.find((x) => x.label === 'Cargo')?.state, 'done');
});

test('verificación: ningún estado técnico llega al usuario sin traducir', () => {
  for (const s of ['submitted', 'pending_evidence', 'under_review', 'approved', 'rejected', 'revoked']) assert.ok(REQUEST_STATUS_TEXT[s]?.label);
  assert.doesNotMatch(REQUEST_STATUS_TEXT.pending_evidence.label, /evidence/);
});
