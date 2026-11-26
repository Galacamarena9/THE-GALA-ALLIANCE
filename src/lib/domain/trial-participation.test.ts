import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canInviteToTrials, invitableTrials, trialApplyState } from './trials.ts';
import { capTierByBudget, matchAthleteToOpportunity } from './match.ts';
import { budgetStatus, dimensionState, type Factor, type GalaMatch } from './gala-match/engine.ts';
import { fitLevel } from './opportunity-discovery.ts';
import { EN } from '../i18n/en.ts';

/* ------------------------------------------------------------ Candidatura a un trial «primero candidatura» */
test('trial con candidatura: sin candidatura y abierto → botón; cerrado → no', () => {
  assert.equal(trialApplyState({ open: true, mode: 'application_required', application: null, registered: false }), 'apply');
  assert.equal(trialApplyState({ open: false, mode: 'application_required', application: null, registered: false }), 'closed');
});

test('trial con candidatura: estados de la candidatura del atleta', () => {
  const s = (status: string) => trialApplyState({ open: true, mode: 'application_required', application: { status }, registered: false });
  assert.equal(s('applied'), 'in_review');
  assert.equal(s('reviewed'), 'in_review');
  assert.equal(s('waitlisted'), 'in_review');
  assert.equal(s('accepted'), 'accepted');
  assert.equal(s('declined'), 'declined');
  assert.equal(s('withdrawn'), 'withdrawn');
});

test('trial con candidatura: con inscripción o en otros modos no se ofrece candidatura', () => {
  assert.equal(trialApplyState({ open: true, mode: 'application_required', application: { status: 'accepted' }, registered: true }), 'not_applicable');
  assert.equal(trialApplyState({ open: true, mode: 'direct', application: null, registered: false }), 'not_applicable');
  assert.equal(trialApplyState({ open: true, mode: 'invitation_only', application: null, registered: false }), 'not_applicable');
  assert.equal(trialApplyState({ open: true, mode: undefined, application: null, registered: false }), 'not_applicable');
});

/* ------------------------------------------------------------ Invitar a prueba */
const now = new Date('2027-03-01T10:00:00Z');
const orgs = [
  { id: 'club', type: 'club', verification_status: 'verified' },
  { id: 'uni', type: 'university', verification_status: 'verified' },
  { id: 'col', type: 'college', verification_status: 'verified' },
  { id: 'acad', type: 'academy', verification_status: 'submitted' },
];
const opp = (o: Partial<{ id: string; organization_id: string; type: string; status: string; deadline: string | null; start_at: string | null }>) =>
  ({ id: 'x', organization_id: 'club', type: 'tryout', status: 'published', deadline: null, start_at: '2027-04-01T10:00:00Z', ...o });

test('invitar a prueba: solo clubes y academias verificados (nunca universidades ni colleges)', () => {
  assert.equal(canInviteToTrials([orgs[0]]), true);
  assert.equal(canInviteToTrials([orgs[1], orgs[2]]), false);
  assert.equal(canInviteToTrials([orgs[3]]), false, 'academia sin verificar');
  assert.equal(canInviteToTrials([]), false);
});

test('invitar a prueba: solo trials publicados, de mi club, con plazo y fecha por delante', () => {
  const list = [
    opp({ id: 'ok' }),
    opp({ id: 'uni', organization_id: 'uni' }),
    opp({ id: 'col', organization_id: 'col', type: 'camp_showcase' }),
    opp({ id: 'draft', status: 'draft' }),
    opp({ id: 'beca', type: 'athletic_scholarship' }),
    opp({ id: 'plazo', deadline: '2027-02-28' }),
    opp({ id: 'pasado', start_at: '2027-02-01T10:00:00Z' }),
    opp({ id: 'hoy', deadline: '2027-03-01' }),
    opp({ id: 'sinfecha', start_at: null }),
  ];
  assert.deepEqual(invitableTrials(orgs, list, now).map((o) => o.id), ['ok', 'hoy', 'sinfecha']);
});

/* ------------------------------------------------------------ Encaje: el coste fuera de presupuesto capa la etiqueta */
const athlete = { sport_id: 'basketball', primary_position_id: 1, secondary_position_id: null, graduation_year: 2027, target_divisions: ['ncaa_d2' as const], annual_budget_usd: 30000 };
const uni = { sport_id: 'basketball', position_ids: [1], graduation_years: [2027], division: 'ncaa_d2' as const, min_gpa_4: 2.5, english_required: null, annual_cost_usd: 38000, aid_amount_usd: 0 };
const acad = { gpa: 8, gpa_scale: 10, english_test: 'toefl' as const, english_score: '90' };

test('encaje (rules): una universidad que la familia no puede pagar no sale como «Encaje fuerte»', () => {
  const m = matchAthleteToOpportunity(athlete, acad, uni);
  assert.equal(m.score, 90, 'el porcentaje no se esconde');
  assert.equal(m.overBudget, true);
  assert.equal(m.tier, 'reach');
  const ok = matchAthleteToOpportunity({ ...athlete, annual_budget_usd: 40000 }, acad, uni);
  assert.equal(ok.overBudget, false);
  assert.equal(ok.tier, 'strong');
});

test('encaje (rules): sin presupuesto o sin coste no se marca fuera de presupuesto', () => {
  assert.equal(matchAthleteToOpportunity({ ...athlete, annual_budget_usd: null }, acad, uni).overBudget, false);
  assert.equal(matchAthleteToOpportunity(athlete, acad, { ...uni, annual_cost_usd: null }).overBudget, false);
});

test('encaje (rules): el tope de presupuesto nunca mejora una etiqueta', () => {
  assert.equal(capTierByBudget('strong', true), 'reach');
  assert.equal(capTierByBudget('potential', true), 'reach');
  assert.equal(capTierByBudget('reach', true), 'reach');
  assert.equal(capTierByBudget('not_eligible', true), 'not_eligible');
  assert.equal(capTierByBudget('strong', false), 'strong');
});

const f = (id: string, status: Factor['status'], kind: Factor['kind'] = 'soft', weight = 10, dimension: Factor['dimension'] = 'athletic'): Factor =>
  ({ id, dimension, kind, weight, status, label: id, detail: '', source: 'official' });
function gm(score: number, factors: Factor[]): GalaMatch {
  const dims = [...new Set(factors.map((x) => x.dimension))].map((d) => ({ dimension: d, score: null, factors: factors.filter((x) => x.dimension === d) }));
  return { score, blocked: false, confidence: 'high', coverage: 100, dimensions: dims, why: [], missing: [], blockers: [], nextStep: null, evidenceGaps: [], version: 't' };
}

test('chips por dimensión: 0 % es «no encaja», nunca «encaje parcial»', () => {
  assert.equal(dimensionState({ score: 0, factors: [f('scholarship', 'unmet')] }), 'no');
  assert.equal(dimensionState({ score: 39, factors: [f('x', 'partial')] }), 'no');
  assert.equal(dimensionState({ score: 40, factors: [f('x', 'partial')] }), 'warn');
  assert.equal(dimensionState({ score: 75, factors: [f('x', 'met')] }), 'ok');
  assert.equal(dimensionState({ score: null, factors: [f('x', 'unknown')] }), 'unknown');
  assert.equal(dimensionState({ score: 90, factors: [f('sport', 'unmet', 'hard')] }), 'blocked');
});

test('chips por dimensión: coste por encima del presupuesto → «Económico: no encaja» aunque la beca cumpla', () => {
  assert.equal(dimensionState({ score: 50, factors: [f('budget', 'unmet', 'soft', 12, 'financial'), f('scholarship', 'met', 'soft', 12, 'financial')] }), 'no');
});

test('etiqueta de encaje (Gala Match): fuera de presupuesto capa a «Encaje parcial»; cerca, a «Buen encaje»', () => {
  const base = [f('sport', 'met', 'hard', 30), f('position', 'met', 'hard', 12)];
  assert.equal(fitLevel(gm(90, [...base, f('budget', 'met', 'soft', 12, 'financial')])), 'strong');
  assert.equal(fitLevel(gm(90, [...base, f('budget', 'unmet', 'soft', 12, 'financial')])), 'partial');
  assert.equal(fitLevel(gm(90, [...base, f('budget', 'partial', 'soft', 12, 'financial')])), 'good');
  assert.equal(fitLevel(gm(50, [...base, f('budget', 'partial', 'soft', 12, 'financial')])), 'partial', 'nunca sube');
  // Vista del agente: el presupuesto es privado, no hay factor y no se capa.
  assert.equal(budgetStatus(gm(90, base)), null);
  assert.equal(fitLevel(gm(90, base)), 'strong');
});

/* ------------------------------------------------------------ Textos nuevos con traducción */
test('trials y costes de familia: cada texto marcado con tx() tiene su traducción al inglés', () => {
  const missing: string[] = [];
  for (const file of ['src/components/trials/TrialApply.tsx', 'src/components/family/CostComparison.tsx']) {
    for (const m of readFileSync(file, 'utf8').matchAll(/tx\('((?:[^'\\]|\\.)*)'\)/g)) {
      const k = m[1].replace(/\\'/g, "'");
      if (!(k in EN)) missing.push(`${file}: ${k}`);
    }
  }
  // Mensajes que devuelven las actions y que el cliente traduce con tx(res.message).
  for (const k of ['Candidatura enviada. Si el club la acepta, tu familia tendrá que aprobar tu participación.', 'Candidatura enviada. Si el club la acepta, quedarás inscrito y te avisaremos.',
    'Ya has presentado tu candidatura a este trial.', 'Este trial no admite candidaturas.', 'Solo los clubes y academias pueden invitar a sus trials.',
    'Invitación enviada. El atleta (y su familia, si es menor) la verá con fecha, lugar y coste.', 'Matrícula', 'Otra ayuda confirmada', 'Por encima del presupuesto']) {
    if (!(k in EN)) missing.push(k);
  }
  assert.deepEqual(missing, []);
});
