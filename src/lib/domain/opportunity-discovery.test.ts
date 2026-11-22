import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCED_FILTERS, DEFAULT_FILTERS, canShortlist, cycleFor, filtersToRecord, fitLevel, parseDiscoveryFilters, passesFilters, projectCard,
  scoreOpportunity, sortCards, type AthleteBase, type DiscoveryOpportunity,
} from './opportunity-discovery.ts';

const NOW = new Date('2026-11-22T12:00:00Z');
const TODAY = '2026-11-22';

/** Atleta ficticia, española, con nota en escala 10 (nunca se convierte) y SIN presupuesto visible para el agente. */
const base: AthleteBase = {
  country: 'ES',
  ctx: {
    sport_id: 'basketball', primary_position_id: 1, secondary_position_id: 2, graduation_year: 2027,
    pathways: ['ncaa_d1', 'ncaa_d2'], countries: ['US'], regions: [], intended_majors: [], school_size: null, sport_level: 'competitive',
    campus_setting: null, scholarship_need: 'partial', annual_budget_usd: 99999, gpa: 8.7, gpa_scale: 10, education_system: 'es',
    has_english_certificate: true, has_highlight: true, has_full_game: false, verified_stats: 1,
  },
};

const opp = (o: Partial<DiscoveryOpportunity> = {}): DiscoveryOpportunity => ({
  id: 'o1', title: 'Beca de baloncesto (ficticia)', type: 'athletic_scholarship', sport_id: 'basketball', position_ids: [1], graduation_years: [2027],
  division: 'ncaa_d2', min_gpa_4: null, english_required: null, deadline: '2027-02-01', annual_cost_usd: 40000, aid_amount_usd: 20000, aid_kind: 'partial',
  financial_source: 'organization_provided', international_eligible: 'yes', country: 'US', location: 'Ohio', published_at: '2026-11-20T10:00:00Z',
  organization: { name: 'Universidad Ficticia', verified: true, institutionId: null }, ...o,
});

const card = (o: DiscoveryOpportunity, b = base) => projectCard(o, scoreOpportunity(b, o, null, NOW), { today: TODAY });

test('filtros: exactamente cinco por defecto y el resto en «Más filtros»', () => {
  assert.equal(DEFAULT_FILTERS.length, 5);
  assert.deepEqual([...DEFAULT_FILTERS], ['sport', 'destination', 'level', 'aid', 'intake']);
  assert.ok(ADVANCED_FILTERS.every((k) => !(DEFAULT_FILTERS as readonly string[]).includes(k)));
});

test('filtros: lista blanca estricta (claves y valores desconocidos se descartan)', () => {
  const f = parseDiscoveryFilters({ sport: 'basketball', destination: 'us', level: 'ncaa_d9', aid: 'gratis', intake: '2027', type: 'tryout', closing: '45', verified: '1', hack: 'x', budget: '1000' }, 2026);
  assert.deepEqual(f, { sport: 'basketball', destination: 'US', intake: 2027, type: 'tryout', verified: true });
  assert.deepEqual(filtersToRecord(f), { sport: 'basketball', destination: 'US', intake: '2027', type: 'tryout', verified: '1' });
  assert.deepEqual(parseDiscoveryFilters({ sport: "basket'; drop" }), {});
});

test('encaje fuerte: todo cumple y la tarjeta trae como mucho 4 motivos', () => {
  const c = card(opp());
  assert.equal(c.eligible, true);
  assert.equal(c.fit, 'strong');
  assert.ok(c.reasons.length > 0 && c.reasons.length <= 4);
  assert.ok(c.why.requirements.every((r) => r.result === 'PASS'));
});

test('un NO CUMPLE obligatorio manda: «No elegible» aunque el resto encaje y no se puede añadir a la shortlist', () => {
  const o = opp({ international_eligible: 'no' });
  const m = scoreOpportunity(base, o, null, NOW);
  assert.ok((m.score ?? 0) >= 80, 'el porcentaje sigue siendo alto');
  const c = projectCard(o, m, { today: TODAY });
  assert.equal(c.fit, 'not_eligible');
  assert.equal(c.fitLabel, 'No elegible');
  assert.equal(c.eligible, false);
  assert.equal(canShortlist(m), false);
  assert.equal(c.why.requirements.find((r) => r.id === 'international')?.result, 'FAIL');
  // Otros NO CUMPLE: promoción y plazo.
  assert.equal(card(opp({ graduation_years: [2029] })).fit, 'not_eligible');
  assert.equal(fitLevel(scoreOpportunity(base, opp({ deadline: '2026-01-01' }), null, NOW)), 'not_eligible');
});

test('lo desconocido se queda desconocido: nunca se cuenta como cumplido', () => {
  const c = card(opp({ international_eligible: 'conditional', min_gpa_4: 3.0 }));
  const intl = c.why.requirements.find((r) => r.id === 'international');
  const gpa = c.why.requirements.find((r) => r.id === 'min_gpa');
  assert.equal(intl?.result, 'UNKNOWN');
  assert.equal(gpa?.result, 'UNKNOWN', 'nota en escala 10: no se convierte a GPA');
  assert.equal(c.eligible, true, 'desconocido no es «no elegible»');
  assert.notEqual(c.fit, 'strong', 'con un obligatorio por confirmar no hay «encaje fuerte»');
  assert.ok(c.keyUnknown, 'se muestra el dato desconocido que más pesa');
  assert.ok(!c.reasons.some((r) => /internacional|nota/i.test(r)), 'un desconocido no aparece como motivo');
  // País del atleta desconocido → requisito de internacionales DESCONOCIDO, no cumplido.
  const c2 = card(opp(), { ...base, country: null });
  assert.equal(c2.why.requirements.find((r) => r.id === 'international')?.result, 'UNKNOWN');
});

test('la proyección no lleva datos protegidos: ni presupuesto ni nota exacta', () => {
  const json = JSON.stringify(card(opp({ min_gpa_4: 3.0 })));
  assert.ok(!json.includes('99999') && !json.includes('99.999'), 'presupuesto');
  assert.ok(!/8[.,]7/.test(json), 'nota exacta');
  assert.ok(!json.toLowerCase().includes('presupuesto'), 'el factor de presupuesto no existe para el agente');
});

test('atleta del mismo país que el destino: no se evalúa como internacional', () => {
  const c = card(opp({ country: 'ES', international_eligible: 'no' }));
  assert.equal(c.why.requirements.find((r) => r.id === 'international'), undefined);
  assert.equal(c.eligible, true);
});

test('filtros sobre la oportunidad: destino (universidad del directorio = EE. UU.), ayuda, año, plazo', () => {
  const o = opp({ country: null, organization: { name: 'U', verified: false, institutionId: 'i1' } });
  assert.equal(passesFilters(o, { destination: 'US' }, TODAY), true);
  assert.equal(passesFilters(o, { destination: 'ES' }, TODAY), false);
  assert.equal(passesFilters(o, { verified: true }, TODAY), false);
  assert.equal(passesFilters(opp({ aid_kind: 'unknown' }), { aid: 'any_aid' }, TODAY), false);
  assert.equal(passesFilters(opp({ aid_kind: 'full' }), { aid: 'any_aid' }, TODAY), true);
  assert.equal(passesFilters(opp({ graduation_years: [] }), { intake: 2030 }, TODAY), true, 'sin promoción publicada = abierta');
  assert.equal(passesFilters(opp(), { intake: 2030 }, TODAY), false);
  assert.equal(passesFilters(opp({ deadline: '2026-11-01' }), {}, TODAY), false, 'plazo pasado');
  assert.equal(passesFilters(opp({ deadline: '2027-06-01' }), { closing: 30 }, TODAY), false);
});

test('orden: las elegibles van antes que las no elegibles', () => {
  const a = opp({ id: 'a', international_eligible: 'no' });
  const b = opp({ id: 'b', min_gpa_4: 3.0 });
  const rows = [a, b].map((o) => { const m = scoreOpportunity(base, o, null, NOW); return { m, card: projectCard(o, m, { today: TODAY }) }; });
  assert.deepEqual(sortCards(rows).map((r) => r.card.id), ['b', 'a']);
});

test('novedades de una búsqueda guardada y temporada del proceso', () => {
  const o = opp();
  const m = scoreOpportunity(base, o, null, NOW);
  assert.equal(projectCard(o, m, { today: TODAY, lastSeenAt: '2026-11-01T00:00:00Z' }).isNew, true);
  assert.equal(projectCard(o, m, { today: TODAY, lastSeenAt: '2026-11-21T00:00:00Z' }).isNew, false);
  assert.equal(cycleFor(2027), '2027-28');
  assert.equal(cycleFor(2099), '2099-00');
});
