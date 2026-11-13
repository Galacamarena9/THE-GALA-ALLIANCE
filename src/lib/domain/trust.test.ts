import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisionMemo, redFlags, trustLevel } from './trust.ts';

const NOW = new Date('2026-11-13T12:00:00Z').getTime();

test('el sello sube nivel a nivel y no salta escalones', () => {
  const base = { status: 'published', orgVerified: true, reviewed: true, financialSource: 'platform_verified', updatedAt: '2026-11-01T00:00:00Z', institutionLinksVerified: true };
  assert.equal(trustLevel(base, NOW).level, 5);
  assert.equal(trustLevel({ ...base, financialSource: 'organization_provided' }, NOW).level, 3);
  assert.equal(trustLevel({ ...base, orgVerified: false }, NOW).level, 1);
  assert.equal(trustLevel({ ...base, updatedAt: '2026-06-01T00:00:00Z' }, NOW).level, 4, 'caduca a los 90 días');
});

test('detecta pagos, garantías, prisa y cifras sin fuente', () => {
  const flags = redFlags({ description: 'Beca garantizada: reserva con un depósito por transferencia, solo hoy.', deadline: '2026-11-14', aidUsd: 50000, costUsd: 50000, financialSource: null, orgVerified: false }, NOW);
  const codes = flags.map((f) => f.code);
  for (const c of ['org_unverified', 'payment', 'guarantee', 'urgency', 'deadline', 'aid_source', 'full_aid']) assert.ok(codes.includes(c), c);
});

test('una oferta limpia no tiene alarmas', () => {
  assert.equal(redFlags({ description: 'Beca parcial para base internacional.', deadline: '2027-03-01', aidUsd: 20000, costUsd: 60000, financialSource: 'organization_provided', orgVerified: true, orgType: 'university', orgWebsite: 'https://www.stateu.edu' }, NOW).length, 0);
});

test('el memo prioriza menos riesgos y menor coste, y no recomienda con riesgos graves', () => {
  const memo = decisionMemo([
    { title: 'A', orgName: 'Uni A', netCostUsd: 30000, matchScore: 70, deadline: '2027-02-01', flags: [], missing: [] },
    { title: 'B', orgName: 'Uni B', netCostUsd: 10000, matchScore: 80, deadline: '2027-01-15', flags: [{ code: 'payment', severity: 'high', text: '' }], missing: [] },
    { title: 'C', orgName: 'Uni C', netCostUsd: null, matchScore: 60, deadline: null, flags: [], missing: [] },
  ]);
  assert.equal(memo.recommended, 'A');
  assert.equal(memo.ranking.at(-1)?.title, 'B');
  assert.equal(memo.decideBy, '2027-01-15');
  assert.ok(memo.questions.some((q) => q.startsWith('Uni C')));
  assert.equal(decisionMemo([{ title: 'X', orgName: 'X', netCostUsd: 1, matchScore: 1, deadline: null, flags: [{ code: 'payment', severity: 'high', text: '' }], missing: [] }]).recommended, null);
});
