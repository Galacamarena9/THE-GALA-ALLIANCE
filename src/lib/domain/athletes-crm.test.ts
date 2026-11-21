import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAttention, type AgentHomeInput } from './agent-home.ts';
import { DEFAULT_CRM, PAGE_SIZE, applyCrm, crmQuery, crmRows, parseCrmFilters, sortCrm, viewCounts, type CrmEntry } from './athletes-crm.ts';

const NOW = new Date('2026-11-21T10:00:00Z');
const d = (n: number) => new Date(Date.parse('2026-11-21T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const e = (id: string, name: string, status: CrmEntry['status'], x: Partial<CrmEntry> = {}): CrmEntry => ({
  athleteId: id, name, avatarUrl: null, sportId: 'basketball', sportName: 'Baloncesto', positionName: 'Base', country: 'ES', graduationYear: 2027,
  status, createdAt: '2026-10-01T00:00:00Z', respondedAt: '2026-10-02T00:00:00Z', endedAt: null, lastNoteAt: null, ...x,
});
const entries = [
  e('a1', 'Marcos Jiménez', 'active'), e('a1', 'Marcos Jiménez', 'ended'), // historial: manda la activa
  e('a2', 'Sofía Martín', 'active', { sportId: 'volleyball', sportName: 'Voleibol', country: 'PT', graduationYear: 2026 }),
  e('a3', 'Daniel Kim', 'active', { country: 'KR' }),
  e('a4', 'Lucía Ferrer', 'requested'),
  e('a5', 'Nora Vidal', 'declined'),
];
const input: AgentHomeInput = {
  athletes: [], tasks: [], followUps: [], repAlerts: [], opportunities: [],
  offers: [{ id: 'o1', athleteId: 'a1', university: 'Lakeshore', aidUsd: 18000, deadline: d(2) }],
  cases: [
    { id: 'c1', athleteId: 'a1', institution: 'Lakeshore', stage: 'offer_discussion', nextAction: 'Decidir oferta', nextActionDue: d(2), updatedAt: '2026-11-20T00:00:00Z' },
    { id: 'c2', athleteId: 'a2', institution: 'Westbrook', stage: 'contacted', nextAction: 'Enviar vídeo', nextActionDue: d(-1), updatedAt: '2026-11-10T00:00:00Z' },
    { id: 'c3', athleteId: 'a3', institution: 'Pine', stage: 'committed', nextAction: null, nextActionDue: null, updatedAt: '2026-11-01T00:00:00Z' },
  ],
};
const rows = () => crmRows(entries, input, buildAttention(input, NOW), [{ athleteId: 'a1', verifiedStats: true, video: true }], NOW);

test('una fila por atleta (manda la representación más viva) y sin datos de otros', () => {
  const r = rows();
  assert.deepEqual(r.map((x) => x.id).sort(), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.equal(r.find((x) => x.id === 'a1')!.rep, 'active');
});

test('«necesita atención» = la misma regla que el Inicio (rangos 1–4) y los segmentos cuadran', () => {
  const r = rows();
  const att = buildAttention(input, NOW).filter((i) => i.rank <= 4);
  for (const x of r) assert.equal(x.attention, att.filter((i) => i.athleteId === x.id).length, x.id);
  const a1 = r.find((x) => x.id === 'a1')!;
  assert.deepEqual(a1.segments, ['all', 'attention', 'offers']);
  assert.equal(a1.journey, 'Oferta');
  assert.equal(a1.offers, 1);
  assert.equal(a1.verification, 'Stats validadas · vídeo');
  assert.ok(r.find((x) => x.id === 'a2')!.segments.includes('recruiting'));
  assert.deepEqual(r.find((x) => x.id === 'a3')!.segments, ['all', 'placed']);
  assert.equal(r.find((x) => x.id === 'a4')!.journey, 'Propuesta pendiente');
});

test('siguiente acción: primero lo que el Inicio marca, si no la próxima fecha', () => {
  const r = rows();
  assert.equal(r.find((x) => x.id === 'a1')!.nextAction, 'Oferta de Lakeshore caduca');
  assert.equal(r.find((x) => x.id === 'a2')!.nextAction, 'Enviar vídeo');
  assert.equal(r.find((x) => x.id === 'a2')!.nextDue, d(-1));
});

test('URL estable y canónica: valores raros vuelven al valor por defecto; ida y vuelta sin cambios', () => {
  const f = parseCrmFilters({ view: 'offers', q: ' Marcos ', sport: 'basketball', grad: '2027', country: 'ES', rep: 'any', sort: 'name', dir: 'desc', page: '2' });
  assert.equal(crmQuery(f, { page: 2 }), '?view=offers&q=Marcos&sport=basketball&grad=2027&country=ES&rep=any&sort=name&dir=desc&page=2');
  assert.deepEqual(parseCrmFilters(Object.fromEntries(new URLSearchParams(crmQuery(f, { page: 2 }).slice(1)))), f);
  assert.deepEqual(parseCrmFilters({ view: 'hack', rep: 'admin', sort: 'drop', country: 'es', grad: '27', page: '-3' }), DEFAULT_CRM);
  assert.equal(crmQuery(DEFAULT_CRM), '');
  assert.equal(crmQuery({ ...DEFAULT_CRM, page: 3 }, { view: 'placed' }), '?view=placed', 'cambiar de vista vuelve a la página 1');
});

test('filtros y búsqueda (sin acentos, por nombre, deporte o siguiente acción)', () => {
  const r = rows();
  assert.deepEqual(applyCrm(r, { ...DEFAULT_CRM, q: 'sofia' }).rows.map((x) => x.id), ['a2']);
  assert.deepEqual(applyCrm(r, { ...DEFAULT_CRM, q: 'enviar video' }).rows.map((x) => x.id), ['a2']);
  assert.deepEqual(applyCrm(r, { ...DEFAULT_CRM, country: 'KR' }).rows.map((x) => x.id), ['a3']);
  assert.deepEqual(applyCrm(r, { ...DEFAULT_CRM, view: 'attention' }).rows.map((x) => x.id).sort(), ['a1', 'a2']);
  assert.equal(applyCrm(r, DEFAULT_CRM).total, 3, 'por defecto solo representados');
  assert.equal(applyCrm(r, { ...DEFAULT_CRM, rep: 'any' }).total, 5);
  assert.equal(applyCrm(r, { ...DEFAULT_CRM, rep: 'closed' }).rows[0].id, 'a5');
  const c = viewCounts(r, DEFAULT_CRM);
  assert.deepEqual(c, { all: 3, attention: 2, recruiting: 1, offers: 1, placed: 1 });
});

test('orden estable y paginación de 25', () => {
  const r = rows();
  assert.deepEqual(sortCrm(r, 'name', 'asc').map((x) => x.name), [...r.map((x) => x.name)].sort((a, b) => a.localeCompare(b, 'es')));
  assert.equal(sortCrm(r, 'attention', 'asc')[0].attention, Math.max(...r.map((x) => x.attention)));
  const many = Array.from({ length: 101 }, (_, i) => ({ ...r[0], id: `x${i}`, name: `Atleta ${String(i).padStart(3, '0')}` }));
  const p1 = applyCrm(many, { ...DEFAULT_CRM, sort: 'name' });
  assert.equal(p1.rows.length, PAGE_SIZE);
  assert.equal(p1.pages, 5);
  const p5 = applyCrm(many, { ...DEFAULT_CRM, sort: 'name', page: 99 });
  assert.equal(p5.page, 5, 'página fuera de rango → última');
  assert.equal(p5.rows.length, 1);
});
