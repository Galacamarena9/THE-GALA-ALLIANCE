import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATHLETE_PROFILE_PUBLIC_COLUMNS, ATHLETE_BLOCK_COLUMNS, withBlockFields } from './profile-columns.ts';

test('las columnas públicas coinciden con el grant de la migración de la fase 6', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261221000100_phase6_privacy.sql', import.meta.url), 'utf8');
  const grant = sql.match(/grant select \(([\s\S]*?)\)\s*on public\.athlete_profiles/)?.[1] ?? '';
  const norm = (s: string) => s.split(',').map((c) => c.trim()).filter(Boolean).sort();
  assert.deepEqual(norm(ATHLETE_PROFILE_PUBLIC_COLUMNS), norm(grant));
  for (const c of ATHLETE_BLOCK_COLUMNS) assert.ok(!norm(grant).includes(c), `${c} no debe leerse de la tabla`);
});

test('withBlockFields: lo que no llega queda a null y los objetivos vacíos', () => {
  const r = withBlockFields({ user_id: 'a', headline: 'x' }, null);
  assert.equal(r.height_cm, null);
  assert.deepEqual(r.target_divisions, []);
  assert.equal(r.user_id, 'a');
  const r2 = withBlockFields({ user_id: 'a' }, { height_cm: 198, target_divisions: null });
  assert.equal(r2.height_cm, 198);
  assert.deepEqual(r2.target_divisions, []);
});
