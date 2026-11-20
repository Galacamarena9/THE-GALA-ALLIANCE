import test from 'node:test';
import assert from 'node:assert/strict';
import { can, coachActions, funnel, needFit, type AthleteFacts, type NeedCriteria } from './recruit.ts';

const need: NeedCriteria = { sport_id: 'basketball', position_ids: [1], class_years: [2027], min_height_cm: 175, requires_video: true, requires_documented_academics: true, countries: [] };
const a: AthleteFacts = { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, height_cm: 178, country: 'ES', has_video: true, academics_documented: true, verified_stats: 2 };

test('recruit: encaje completo con datos visibles', () => {
  const f = needFit(need, a);
  assert.equal(f.score, 100); assert.equal(f.blocked, false); assert.equal(f.confidence, 'high');
});
test('recruit: requisito duro incumplido bloquea (otra posición o año)', () => {
  assert.equal(needFit(need, { ...a, primary_position_id: 5 }).blocked, true);
  assert.equal(needFit(need, { ...a, graduation_year: 2029 }).score, 0);
});
test('recruit: datos privados no penalizan como incumplidos, bajan la confianza', () => {
  const f = needFit(need, { ...a, height_cm: null, academics_documented: null, verified_stats: null });
  assert.equal(f.unmet.length, 0);
  assert.ok(f.missing.some((x) => x.key === 'height'));
  assert.notEqual(f.confidence, 'high');
});
test('recruit: sin datos suficientes no hay porcentaje', () => {
  assert.equal(needFit({ ...need, position_ids: [], class_years: [], requires_video: false }, { ...a, height_cm: null, has_video: false, academics_documented: null, verified_stats: null }).score, null);
});
test('recruit: permisos por rol y verificación', () => {
  assert.equal(can('assistant_coach', 'discover', true), true);
  assert.equal(can('assistant_coach', 'discover', false), false);
  assert.equal(can('admissions', 'discover', true), false);
  assert.equal(can('admin', 'manage_members', false), true);
  assert.equal(can('compliance', 'audit', true), true);
});
test('recruit: siguiente acción del staff prioriza verificación y caducidades', () => {
  const r = coachActions({ verified: false, hasPrograms: false, activeNeeds: 0, newApplications: 2, toReview: 0, overdueTasks: 0, dueTodayTasks: 0, expiringOpportunities: [{ id: 'o', title: 'Beca', days: 2 }], sharedInfo: 0, members: 3 });
  assert.equal(r[0].priority, 'urgent');
  assert.ok(r.some((x) => x.key === 'exp:o'));
});
test('recruit: embudo acumulativo', () => {
  const f = funnel(['new', 'review', 'contact', 'offer', 'committed']);
  assert.deepEqual(f.map((x) => x.value), [5, 4, 3, 2, 1]);
});

test('publicar: no se anuncia ayuda sin estado de beca y la caducidad es coherente', async () => {
  const { validatePublish } = await import('./recruit.ts');
  const base = { scholarship_status: 'not_provided' as const, aid_amount_usd: null, aid_kind: 'unknown' as const, deadline: '2027-01-10', expires_at: null };
  assert.deepEqual(validatePublish(base, '2026-11-20'), {});
  assert.ok(validatePublish({ ...base, aid_kind: 'full' }, '2026-11-20').scholarship_status);
  assert.ok(validatePublish({ ...base, scholarship_status: 'amount_stated' }, '2026-11-20').aid_amount_usd);
  assert.ok(validatePublish({ ...base, expires_at: '2027-01-01' }, '2026-11-20').expires_at);
  assert.ok(validatePublish({ ...base, expires_at: '2026-10-01', deadline: null }, '2026-11-20').expires_at);
});
