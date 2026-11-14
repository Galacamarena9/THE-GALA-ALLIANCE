import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeline, DEFAULT_FILTERS, dueText, filterPortfolio, filtersToQuery, friendlyDbError, gradOptions, initials,
  isOverdue, nextSteps, parseFilters, portfolioStats, sportOptions, statusCounts, type AgencyNote, type PortfolioEntry,
} from './portfolio.ts';

const entry = (o: Partial<PortfolioEntry> & { athleteId: string; name: string }): PortfolioEntry => ({
  repId: `rep-${o.athleteId}`, agencyId: 'ag', agencyName: 'Agencia', agentId: 'me', status: 'active', message: null,
  createdAt: '2026-10-01T10:00:00.000Z', respondedAt: null, endedAt: null, avatarUrl: null, country: null,
  sportId: null, sportName: null, positionName: null, graduationYear: null, currentTeam: null, hasVideo: false,
  lastNoteAt: null, ...o,
});

const note = (o: Partial<AgencyNote>): AgencyNote => ({
  id: 'n1', agency_id: 'ag', athlete_id: 'a', author_id: 'me', kind: 'note', body: 'texto', due_date: null, done: false,
  done_at: null, created_at: '2026-11-01T09:00:00.000Z', updated_at: '2026-11-01T09:00:00.000Z', ...o,
});

const data = [
  entry({ athleteId: 'a', name: 'María López', sportId: 'basketball', sportName: 'Baloncesto', positionName: 'Base', graduationYear: 2027, createdAt: '2026-09-01T00:00:00Z' }),
  entry({ athleteId: 'b', name: 'Álvaro Ruiz', status: 'requested', sportId: 'soccer', sportName: 'Fútbol', positionName: 'Mediocentro', graduationYear: 2026, createdAt: '2026-11-01T00:00:00Z' }),
  entry({ athleteId: 'c', name: 'Zoe Kim', status: 'declined', sportId: 'basketball', sportName: 'Baloncesto', createdAt: '2026-10-01T00:00:00Z' }),
];

test('cartera: búsqueda sin acentos por nombre, deporte o posición', () => {
  assert.deepEqual(filterPortfolio(data, { ...DEFAULT_FILTERS, q: 'alvaro' }).map((e) => e.athleteId), ['b']);
  assert.deepEqual(filterPortfolio(data, { ...DEFAULT_FILTERS, q: 'base' }).map((e) => e.athleteId), ['a']);
});

test('cartera: filtros por estado, deporte y promoción', () => {
  assert.equal(filterPortfolio(data, { ...DEFAULT_FILTERS, status: 'requested' }).length, 1);
  assert.equal(filterPortfolio(data, { ...DEFAULT_FILTERS, sport: 'basketball' }).length, 2);
  assert.deepEqual(filterPortfolio(data, { ...DEFAULT_FILTERS, grad: 2026 }).map((e) => e.athleteId), ['b']);
});

test('cartera: orden por reciente, nombre y promoción (sin año al final)', () => {
  assert.deepEqual(filterPortfolio(data, DEFAULT_FILTERS).map((e) => e.athleteId), ['b', 'c', 'a']);
  assert.deepEqual(filterPortfolio(data, { ...DEFAULT_FILTERS, sort: 'name' }).map((e) => e.athleteId), ['b', 'a', 'c']);
  assert.deepEqual(filterPortfolio(data, { ...DEFAULT_FILTERS, sort: 'grad' }).map((e) => e.athleteId), ['b', 'a', 'c']);
});

test('cartera: opciones de filtro solo con valores reales', () => {
  assert.deepEqual(sportOptions(data), [{ id: 'basketball', name: 'Baloncesto' }, { id: 'soccer', name: 'Fútbol' }]);
  assert.deepEqual(gradOptions(data), [2026, 2027]);
  assert.deepEqual(statusCounts(data), { all: 3, active: 1, requested: 1, declined: 1, ended: 0 });
});

test('cartera: los filtros viajan en la URL y se ignora lo inválido', () => {
  const f = parseFilters({ q: 'ana', status: 'requested', grad: '2027', sort: 'name', sport: 'basketball' });
  assert.deepEqual(f, { q: 'ana', status: 'requested', sport: 'basketball', grad: 2027, sort: 'name' });
  assert.equal(filtersToQuery(f), '?q=ana&status=requested&sport=basketball&grad=2027&sort=name');
  assert.equal(filtersToQuery(f, { status: 'all', q: '' }), '?sport=basketball&grad=2027&sort=name');
  assert.deepEqual(parseFilters({ status: 'hack', grad: '20x7', sort: 'evil', sport: "x'; drop" }), DEFAULT_FILTERS);
});

test('cartera: KPIs reales (activos, pendientes, nuevos y seguimientos vencidos)', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const s = portfolioStats(
    [entry({ athleteId: 'a', name: 'A', createdAt: '2026-11-10T00:00:00Z' }), entry({ athleteId: 'b', name: 'B', status: 'requested', createdAt: '2026-08-01T00:00:00Z' })],
    [{ kind: 'follow_up', done: false, due_date: '2026-11-01' }, { kind: 'follow_up', done: false, due_date: '2026-12-01' },
     { kind: 'follow_up', done: true, due_date: '2026-10-01' }, { kind: 'note', done: false, due_date: null }],
    now,
  );
  assert.deepEqual(
    { a: s.active, p: s.pending, n: s.newLast30Days, o: s.openFollowUps, v: s.overdueFollowUps },
    { a: 1, p: 1, n: 1, o: 2, v: 1 },
  );
});

test('actividad: eventos reales ordenados del más reciente al más antiguo', () => {
  const events = buildTimeline(
    [
      entry({ athleteId: 'a', name: 'Ana', status: 'ended', createdAt: '2026-09-01T00:00:00Z', respondedAt: '2026-09-02T00:00:00Z', endedAt: '2026-10-01T00:00:00Z' }),
      entry({ athleteId: 'b', name: 'Beto', status: 'ended', createdAt: '2026-09-05T00:00:00Z', endedAt: '2026-09-06T00:00:00Z' }),
    ],
    [note({ athlete_id: 'a', kind: 'follow_up', done: true, done_at: '2026-11-02T00:00:00Z' })],
  );
  assert.deepEqual(events.map((e) => e.kind), ['follow_up_done', 'follow_up', 'ended', 'withdrawn', 'requested', 'accepted', 'requested']);
  assert.equal(events[0].athleteName, 'Ana');
  assert.equal(buildTimeline([entry({ athleteId: 'x', name: 'X' })], [], 0).length, 0);
});

test('próximos pasos: solo seguimientos abiertos, por fecha y con vencidos marcados', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const steps = nextSteps(
    [note({ id: 'f1', kind: 'follow_up', due_date: '2026-11-20' }), note({ id: 'f2', kind: 'follow_up', due_date: '2026-11-10' }),
     note({ id: 'f3', kind: 'follow_up' }), note({ id: 'f4', kind: 'follow_up', done: true, due_date: '2026-11-01' }), note({ id: 'n' })],
    new Map([['a', 'Ana']]),
    now,
  );
  assert.deepEqual(steps.map((s) => s.noteId), ['f2', 'f1', 'f3']);
  assert.equal(steps[0].overdue, true);
  assert.equal(steps[0].athleteName, 'Ana');
});

test('utilidades: iniciales, vencimientos y errores legibles', () => {
  assert.equal(initials('María José López'), 'ML');
  assert.equal(initials(''), '?');
  const now = new Date('2026-11-14T08:00:00');
  assert.equal(isOverdue('2026-11-13', now), true);
  assert.equal(isOverdue('2026-11-14', now), false);
  assert.equal(dueText('2026-11-14', now), 'Hoy');
  assert.match(dueText('2026-11-01', now), /^Vencido/);
  assert.match(friendlyDbError('representation_transition_not_allowed'), /Solo el atleta/);
  assert.match(friendlyDbError('new row violates row-level security policy'), /permiso/);
});
