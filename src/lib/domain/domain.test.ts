import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAge, ageOn } from './age.ts';
import { matchAthleteToOpportunity, toGpa4 } from './match.ts';
import { computeReadiness } from './readiness.ts';
import { stageFor, roadmapFor } from './roadmap.ts';
import { computeNetCost } from './netCost.ts';
import { institutionFit } from './institutionFit.ts';

const today = new Date('2026-11-13T12:00:00Z');

test('edad: cumpleaños aún no alcanzado este año', () => {
  assert.equal(ageOn('2010-12-01', today), 15);
  assert.equal(ageOn('2010-11-13', today), 16);
});

test('COPPA: menores de 13 rechazados; 13 permitido y con consentimiento parental en España', () => {
  assert.deepEqual(checkAge('2014-01-01', today), { ok: false, reason: 'under_13' });
  const r = checkAge('2013-01-01', today);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.isMinor, true);
    assert.equal(r.needsGuardianConsent, true);
  }
  assert.deepEqual(checkAge('no-date', today), { ok: false, reason: 'invalid' });
});

test('GPA: conversión aproximada a escala 4.0', () => {
  assert.equal(toGpa4(8, 10), 3.2);
  assert.equal(toGpa4(null, 10), null);
});

const athlete = { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, target_divisions: ['ncaa_d2' as const], annual_budget_usd: 15000 };
const opp = { sport_id: 'basketball', position_ids: [1], graduation_years: [2027], division: 'ncaa_d2' as const, min_gpa_4: 2.5, english_required: null, annual_cost_usd: 40000, aid_amount_usd: 30000 };

test('matching: encaje fuerte cuando todo cumple', () => {
  const m = matchAthleteToOpportunity(athlete, { gpa: 8, gpa_scale: 10, english_test: 'toefl', english_score: '90' }, opp);
  assert.equal(m.tier, 'strong');
  assert.equal(m.score, 100);
  assert.equal(m.unmet.length, 0);
});

test('matching: un requisito obligatorio incumplido → no encaja ahora', () => {
  const m = matchAthleteToOpportunity({ ...athlete, sport_id: 'soccer' }, null, opp);
  assert.equal(m.tier, 'not_eligible');
  assert.ok(m.unmet.includes('Deporte'));
});

test('matching: un dato que falta no se trata como incumplido', () => {
  const m = matchAthleteToOpportunity(athlete, null, opp);
  assert.equal(m.tier, 'potential');
  assert.ok(m.missing.some((x) => x.includes('Nota')));
});

test('matching: sin cifras de coste no se inventa el encaje económico', () => {
  const m = matchAthleteToOpportunity(athlete, { gpa: 8, gpa_scale: 10, english_test: null, english_score: null }, { ...opp, aid_amount_usd: null });
  assert.ok(m.missing.some((x) => x.includes('coste')));
});

test('readiness: perfil vacío propone la acción de más peso (vídeo)', () => {
  const r = computeReadiness({ profile: null, academics: null, statsCount: 0, languagesCount: 0, achievementsCount: 0, hasFamilyLink: false, isMinor: true });
  assert.equal(r.score, 0);
  assert.equal(r.nextAction?.key, 'video');
});

test('roadmap: la etapa depende de los años hasta la graduación', () => {
  assert.equal(stageFor(2030, today), 'explore');
  assert.equal(stageFor(2029, today), 'profile');
  assert.equal(stageFor(2028, today), 'contact');
  assert.equal(stageFor(2027, today), 'apply');
  assert.equal(stageFor(2026, today), 'commit');
  const naiaOnly = roadmapFor(2029, ['naia'], today).flatMap((s) => s.tasks.map((t) => t.id));
  assert.ok(naiaOnly.includes('register-naia'));
  assert.ok(!naiaOnly.includes('register-ncaa'));
});

test('coste neto: escenarios y partidas desconocidas', () => {
  const r = computeNetCost({
    id: 'a', name: 'A', years: 4, annualIncreasePct: 0,
    costs: { tuition: 30000, fees: 2000, housing: 8000, meals: 4000, insurance: 2000, books: null, travel: 1500, visa: 500, other: null },
    aid: { athleticConfirmed: 25000, academicConfirmed: 5000, otherConfirmed: null, estimated: 4000 },
  });
  assert.equal(r.gross, 48000);
  assert.equal(r.confirmed, 30000);
  assert.equal(r.expected.firstYear, 16000);
  assert.equal(r.optimistic.firstYear, 14000);
  assert.equal(r.conservative.firstYear, 22800);
  assert.equal(r.expected.total, 64000);
  assert.deepEqual(r.unknownCosts, ['books', 'other']);
});

test('encaje con universidad: sin el deporte, encaje bajo', () => {
  const f = institutionFit({ sport_id: 'tennis', target_divisions: ['ncaa_d1'] }, 20000, { sports_offered: ['basketball'], division: 'ncaa_d1', cost_attendance_usd: 15000 });
  assert.equal(f.level, 'bajo');
  const g = institutionFit({ sport_id: 'basketball', target_divisions: ['ncaa_d1'] }, 20000, { sports_offered: ['basketball'], division: 'ncaa_d1', cost_attendance_usd: 15000 });
  assert.equal(g.level, 'alto');
});
