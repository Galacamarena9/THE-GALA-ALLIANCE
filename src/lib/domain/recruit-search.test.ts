import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIVITY_LABEL, ENGLISH_LABEL, SORT_LABEL, activeFilterCount, activityLine, classYears, compareRows, parseSearch, rpcFilters,
  savedSearchHref, startTerms, termBounds, type CompareInput,
} from './recruit-search.ts';
import { EN } from '../i18n/en.ts';
import { makeT } from '../i18n/t.ts';

const NOW = new Date('2026-11-27T10:00:00Z');

test('buscador: la promoción admite graduados de los 3 últimos años (europeos de 19-20) y +5', () => {
  assert.deepEqual(classYears(NOW), [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031]);
  assert.equal(parseSearch({ grad: '2024' }, NOW).grad, 2024);
  assert.equal(parseSearch({ grad: '2019' }, NOW).grad, undefined, 'fuera de rango');
});

test('buscador: la URL se normaliza; lo inválido se ignora y nunca hay presupuesto', () => {
  const f = parseSearch({ sport: 'basketball', gpa: '3.25', eng: 'b2', etest: '1', div: 'ncaa_d2', start: '2027-fall', open: '1', ncaa: '1', sort: 'grad', h: '185', budget: '10000' }, NOW);
  assert.deepEqual(f, { sport: 'basketball', min_gpa: 3.3, english: 'b2', english_test: true, division: 'ncaa_d2', start: '2027-fall', open: true, contactable: true, sort: 'grad', min_height: 185 });
  assert.deepEqual(parseSearch({ gpa: '5', eng: 'z9', div: 'nba', start: '2027-08', sort: 'talent', h: '90', sport: 'DROP TABLE' }, NOW), {});
  assert.ok(!('budget' in parseSearch({ budget: '1' }, NOW)));
});

test('buscador: p_filters de la RPC; ordenar por encaje exige una necesidad', () => {
  assert.deepEqual(rpcFilters({ min_gpa: 3, open: true, video: false, sort: 'fit' }, 'basketball'), { sport: 'basketball', min_gpa: 3, open: true });
  assert.deepEqual(rpcFilters({ sort: 'fit' }, 'basketball', 'n1'), { sport: 'basketball', sort: 'fit', need: 'n1' });
});

test('buscador: periodos de incorporación (espejo de la RPC)', () => {
  assert.deepEqual(termBounds('2027-fall'), { from: '2027-06', to: '2027-10' });
  assert.deepEqual(termBounds('2028-spring'), { from: '2027-11', to: '2028-05' });
  assert.equal(termBounds('2027-08'), null);
  assert.deepEqual(startTerms(NOW).slice(0, 3), ['2027-spring', '2027-fall', '2028-spring']);
});

test('búsquedas guardadas: vuelven a la URL del buscador con la necesidad y la organización', () => {
  const href = savedSearchHref({ sport: 'basketball', english: 'b2', min_gpa: 3, open: true, sort: 'grad' }, null, 'org1');
  assert.equal(href, '/app/recruit/discover?org=org1&sport=basketball&gpa=3&eng=b2&open=1&sort=grad');
  const withNeed = savedSearchHref({ sport: 'basketball', grad: 2025 }, 'need1');
  assert.equal(withNeed, '/app/recruit/discover?need=need1&grad=2025', 'con necesidad, el deporte lo pone la necesidad');
  // Ida y vuelta: lo guardado se lee igual.
  const back = parseSearch(Object.fromEntries(new URL(href, 'https://x').searchParams), NOW);
  assert.deepEqual(back, { sport: 'basketball', min_gpa: 3, english: 'b2', open: true, sort: 'grad' });
  assert.equal(activeFilterCount(back), 3);
});

const lucia: CompareInput = {
  user_id: 'a', display_name: 'Lucía', position: 'Base', graduation_year: 2025, height: '1,78 m', country: 'ES', competitive_level: 'LF2',
  has_video: true, video_url: 'https://example.com/v', academics: { gpa: 8.4, gpa_scale: 10, grade_display: null, gpa_source: 'document_verified', english_test: 'toefl', english_score: '96' },
  english_level: 'c1', stats: [{ label: 'Puntos', value: 14.2, unit: null, source: 'club_verified' }], verified: true,
};
const marta: CompareInput = { ...lucia, user_id: 'b', display_name: 'Marta', height: null, academics: null, stats: null, video_url: null, has_video: false, english_level: null, verified: false };

test('comparar: valores reales lado a lado, no sí/no; lo no compartido sale como 🔒', () => {
  const rows = compareRows([lucia, marta]);
  const get = (k: string) => rows.find((r) => r.key === k)!.cells;
  assert.deepEqual(rows.map((r) => r.key), ['position', 'class', 'height', 'country', 'level', 'gpa', 'english', 'video', 'stats', 'verification']);
  assert.equal(get('height')[0].text, '1,78 m');
  assert.match(get('height')[1].text, /🔒/);
  assert.equal(get('gpa')[0].text, '8.4/10 · ≈ 3.36 GPA est. (no oficial) · documentada');
  assert.match(get('gpa')[1].text, /🔒/);
  assert.equal(get('english')[0].text, 'TOEFL 96 · C1');
  assert.equal(get('video')[0].href, 'https://example.com/v');
  assert.equal(get('stats')[0].text, 'Puntos 14.2 ✓');
  assert.equal(get('verification')[1].tone, 'muted');
});

test('actividad del equipo: dice quién y sobre qué atleta', () => {
  assert.equal(activityLine('note_added', 'Marta', 'Lucía'), 'Marta añadió una nota sobre Lucía');
  assert.equal(activityLine('stage_changed', null, 'Lucía'), 'Alguien del equipo cambió de etapa a Lucía');
  assert.equal(activityLine('info_shared', 'Lucía', 'Lucía'), 'Lucía compartió la información solicitada');
  assert.equal(activityLine('member_added', 'Marta', null), null, 'sin atleta: la página muestra el tipo');
  const en = makeT('en');
  assert.equal(activityLine('note_added', 'Marta', 'Lucía', en), 'Marta added a note on Lucía');
});

test('textos nuevos del coach/club: todo traducido al inglés', () => {
  const en = makeT('en');
  const missing: string[] = [];
  const files = ['src/components/recruit/DiscoverFilters.tsx', 'src/components/recruit/SaveOrgSearch.tsx', 'src/components/recruit/CompareTable.tsx',
    'src/components/OrganizationPublicView.tsx', 'src/app/organizaciones/[id]/page.tsx', 'src/app/actions/saved-searches.ts', 'src/app/app/recruit/compare/page.tsx'];
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/tx\('((?:[^'\\]|\\.)*)'\)/g)) {
    const k = m[1].replace(/\\'/g, "'");
    if (!(k in EN)) missing.push(`${f}: ${k}`);
  }
  for (const v of [...Object.values(SORT_LABEL), ...Object.values(ENGLISH_LABEL), ...Object.values(ACTIVITY_LABEL), 'Alguien del equipo']) if (!(v in EN)) missing.push(v);
  for (const r of compareRows([lucia, marta], (s) => { if (!(s in EN)) missing.push(s); return s; })) void r;
  assert.deepEqual(missing, []);
  assert.equal(en('Promoción'), 'Grad year');
});
