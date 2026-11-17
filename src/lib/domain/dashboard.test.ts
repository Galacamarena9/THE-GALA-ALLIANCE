import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritize, stageOf, journey, type DashboardInput } from './dashboard.ts';
import { computeReadiness } from './readiness.ts';

const now = new Date('2026-11-17T10:00:00');
const empty = computeReadiness({ profile: null, academics: null, statsCount: 0, languagesCount: 0, achievementsCount: 0, hasFamilyLink: false, isMinor: false });
const base: DashboardInput = {
  readiness: empty, unseenMatches: 0, savedUniversities: 0, savedOpportunities: 0, applications: [], offers: [],
  officialDeadlines: [], highMatchOpportunities: 0, isMinor: false, seeksUSCollege: true, now,
};

test('dashboard: un plazo oficial a 2 días pasa por delante de todo', () => {
  const r = prioritize({ ...base, unseenMatches: 3, officialDeadlines: [{ id: 'o1', title: 'Beca X', date: '2026-11-19', href: '/x' }] });
  assert.equal(r[0].key, 'deadline:o1');
  assert.equal(r[0].priority, 'urgent');
});

test('dashboard: sin urgencias reales, Passport incompleto es lo primero', () => {
  const r = prioritize({ ...base, unseenMatches: 3 });
  assert.equal(r[0].group, 'passport');
  assert.equal(r.some((x) => x.priority === 'urgent'), false);
});

test('dashboard: plazos lejanos o vencidos no generan urgencia', () => {
  const r = prioritize({ ...base, officialDeadlines: [{ id: 'a', title: 'A', date: '2027-03-01', href: '/a' }, { id: 'b', title: 'B', date: '2026-11-01', href: '/b' }] });
  assert.equal(r.some((x) => x.key.startsWith('deadline:')), false);
});

test('dashboard: sin objetivo de universidad en EE. UU. no empuja matches de college', () => {
  const r = prioritize({ ...base, seeksUSCollege: false, unseenMatches: 5, highMatchOpportunities: 2 });
  assert.equal(r.some((x) => x.key === 'matches:new' || x.key === 'opps:high'), false);
});

test('dashboard: etapa según datos reales', () => {
  assert.equal(stageOf(base), 'early');
  assert.equal(stageOf({ ...base, savedUniversities: 2 }), 'discovery');
  assert.equal(stageOf({ ...base, applications: [{ id: '1', status: 'applied', deadline: null, title: 'X' }] }), 'active');
  assert.equal(stageOf({ ...base, offers: [{ id: '1', university_name: 'U', deadline: null, in_writing: true }] }), 'decision');
});

test('dashboard: el recorrido marca el paso actual', () => {
  const j = journey({ ...base, savedUniversities: 4 });
  assert.equal(j.find((s) => s.current)?.key, 'passport');
});
