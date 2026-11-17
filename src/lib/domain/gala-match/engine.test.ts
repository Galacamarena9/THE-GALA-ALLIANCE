import test from 'node:test';
import assert from 'node:assert/strict';
import { galaMatch, estimatedIntlCost, type AthleteContext, type InstitutionTarget, type OpportunityTarget } from './engine.ts';
import { programMatch, resolveMajor } from './majors.ts';

const athlete: AthleteContext = {
  sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027,
  pathways: ['ncaa_d1', 'ncaa_d2'], countries: ['US'], regions: ['Florida'], intended_majors: ['Business'],
  school_size: 'medium', sport_level: 'competitive', campus_setting: 'urban', scholarship_need: 'partial', annual_budget_usd: 30000,
  gpa: 8.7, gpa_scale: 10, education_system: 'es', has_english_certificate: true, has_highlight: true, has_full_game: false, verified_stats: 0,
};
const uni: InstitutionTarget = {
  kind: 'institution', id: 'u1', name: 'Test U', state: 'FL', sports_offered: ['basketball', 'tennis'], division: 'ncaa_d2', association: 'ncaa',
  athletic_source: 'manual_admin', ownership: 'private_nonprofit', locale: 'city', enrollment: 9000, cost_attendance_usd: 28000,
  tuition_in_state_usd: 20000, tuition_out_of_state_usd: 20000, program_cips: ['5202', '4201'],
};

test('gala match: universidad que encaja en todo, con alta confianza', () => {
  const m = galaMatch(athlete, uni);
  assert.equal(m.blocked, false);
  assert.equal(m.score, 100);
  assert.equal(m.confidence, 'high');
  assert.ok(m.why.some((f) => f.id === 'program' && f.detail.includes('exacta')));
});

test('gala match: deporte no disponible es un bloqueo visible, no un porcentaje bonito', () => {
  const m = galaMatch(athlete, { ...uni, sports_offered: ['soccer'] });
  assert.equal(m.blocked, true);
  assert.equal(m.blockers[0].id, 'sport');
});

test('gala match: sin datos suficientes no hay porcentaje', () => {
  const empty: AthleteContext = { ...athlete, sport_id: null, pathways: [], countries: [], regions: [], intended_majors: [], school_size: null, sport_level: null, campus_setting: null, annual_budget_usd: null };
  const m = galaMatch(empty, { ...uni, sports_offered: [], division: null, program_cips: [], enrollment: null });
  assert.equal(m.score, null);
  assert.equal(m.confidence, 'low');
  assert.ok(m.nextStep);
});

test('gala match: no se infiere qué posición necesita una universidad sin oportunidad publicada', () => {
  const m = galaMatch(athlete, uni);
  assert.equal(m.dimensions.flatMap((d) => d.factors).some((f) => f.id === 'position'), false);
});

test('gala match: no se convierten notas internacionales a GPA', () => {
  const opp: OpportunityTarget = {
    kind: 'opportunity', id: 'o1', name: 'Beca', sport_id: 'basketball', position_ids: [1], graduation_years: [2027], division: 'ncaa_d2',
    min_gpa_4: 3.0, english_required: 'TOEFL 80', deadline: '2099-01-01', annual_cost_usd: 40000, aid_amount_usd: 15000, aid_kind: 'partial', financial_source: 'organization_provided',
  };
  const m = galaMatch(athlete, opp);
  const gpa = m.missing.find((f) => f.id === 'min_gpa');
  assert.ok(gpa && gpa.detail.includes('no la convertimos'));
  // Ayuda confirmada por la organización: 40.000 - 15.000 = 25.000 ≤ 30.000.
  assert.equal(m.dimensions.find((d) => d.dimension === 'financial')!.factors.find((f) => f.id === 'budget')!.status, 'met');
});

test('gala match: sin ayuda confirmada no se resta beca', () => {
  const opp: OpportunityTarget = {
    kind: 'opportunity', id: 'o2', name: 'Plaza', sport_id: 'basketball', position_ids: [], graduation_years: [], division: null,
    min_gpa_4: null, english_required: null, deadline: null, annual_cost_usd: 40000, aid_amount_usd: 15000, aid_kind: 'partial', financial_source: 'unverified',
  };
  const budget = galaMatch(athlete, opp).dimensions.find((d) => d.dimension === 'financial')!.factors.find((f) => f.id === 'budget')!;
  assert.equal(budget.status, 'unmet');
  assert.ok(budget.detail.includes('sin becas'));
});

test('gala match: plazo vencido bloquea', () => {
  const opp: OpportunityTarget = {
    kind: 'opportunity', id: 'o3', name: 'Plaza', sport_id: 'basketball', position_ids: [], graduation_years: [], division: null,
    min_gpa_4: null, english_required: null, deadline: '2020-01-01', annual_cost_usd: null, aid_amount_usd: null, aid_kind: null, financial_source: null,
  };
  assert.equal(galaMatch(athlete, opp).blockers[0].id, 'deadline');
});

test('coste internacional estimado: en públicas usa la matrícula de no residente', () => {
  assert.equal(estimatedIntlCost({ cost_attendance_usd: 25000, tuition_in_state_usd: 10000, tuition_out_of_state_usd: 30000, ownership: 'public' }), 45000);
  assert.equal(estimatedIntlCost({ cost_attendance_usd: 50000, tuition_in_state_usd: 40000, tuition_out_of_state_usd: 40000, ownership: 'private_nonprofit' }), 50000);
});

test('taxonomía de estudios: exacto vs relacionado', () => {
  const b = resolveMajor('ADE')!;
  assert.equal(programMatch(b, ['5202']), 'exact');
  assert.equal(programMatch(b, ['5214']), 'related');
  assert.equal(programMatch(b, ['4201']), 'none');
  assert.equal(resolveMajor('Astrofísica cuántica'), null);
});
