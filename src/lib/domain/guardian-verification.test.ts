import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARDIAN_STATEMENT_VERSION, guardianErrorMessage, guardianStateCopy, guardianStatement } from './guardian-verification.ts';

test('la versión del texto coincide con la de la base de datos', () => {
  assert.match(GUARDIAN_STATEMENT_VERSION, /^guardian-\d{4}-\d{2}$/);
  assert.equal(GUARDIAN_STATEMENT_VERSION, 'guardian-2026-11');
});

test('la declaración nombra al atleta y no promete nada más', () => {
  const s = guardianStatement('Lucía');
  assert.match(s, /tutor legal de Lucía/);
  assert.doesNotMatch(s, /autoridades|denuncia/);
});

test('cada estado tiene su explicación; los que no aplican no muestran nada', () => {
  assert.equal(guardianStateCopy('needs_attestation')?.tone, 'warn');
  assert.equal(guardianStateCopy('pending_review')?.tone, 'neutral');
  assert.equal(guardianStateCopy('verified')?.tone, 'ok');
  assert.equal(guardianStateCopy('not_required'), null);
  assert.equal(guardianStateCopy(undefined), null);
});

test('traduce solo el error de verificación', () => {
  assert.match(guardianErrorMessage('ERROR: guardian_verification_required') ?? '', /tutor legal/);
  assert.equal(guardianErrorMessage('not_found'), null);
});

test('la migración declara la misma versión que la interfaz', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync('supabase/migrations/20261220000100_phase5_guardian_verification.sql', 'utf8');
  assert.match(sql, new RegExp(`select '${GUARDIAN_STATEMENT_VERSION}'::text`));
});
