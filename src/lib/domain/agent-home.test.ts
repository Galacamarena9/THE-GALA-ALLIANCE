import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTENTION_RANK, athletesPreview, buildAttention, dueStateOf, pipelineCounts, safeInternalPath, summarize,
  type AgentHomeInput,
} from './agent-home.ts';

const NOW = new Date('2026-11-21T10:00:00Z');
const T = '2026-11-21';
const d = (n: number) => new Date(Date.parse(`${T}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const base = (): AgentHomeInput => ({
  athletes: [
    { id: 'a1', name: 'Marcos', sportId: 'basketball', sportName: 'Baloncesto', positionName: 'Base', graduationYear: 2027, status: 'active', lastActivityAt: '2026-11-20T09:00:00Z' },
    { id: 'a2', name: 'Sofía', sportId: 'volleyball', sportName: 'Voleibol', positionName: null, graduationYear: 2026, status: 'active', lastActivityAt: null },
    { id: 'a3', name: 'Lucía', sportId: 'tennis', sportName: 'Tenis', positionName: null, graduationYear: 2027, status: 'requested', lastActivityAt: null },
  ],
  offers: [
    { id: 'o1', athleteId: 'a1', university: 'Lakeshore', aidUsd: 18000, deadline: d(2) },
    { id: 'o2', athleteId: 'a1', university: 'Northfield', aidUsd: 24000, deadline: d(20) },
    { id: 'o3', athleteId: 'a2', university: 'Old', aidUsd: null, deadline: d(-3) },
  ],
  cases: [
    { id: 'c1', athleteId: 'a1', institution: 'Northfield', stage: 'response_received', nextAction: null, nextActionDue: null, updatedAt: `${d(-1)}T08:00:00Z` },
    { id: 'c2', athleteId: 'a1', institution: 'Lakeshore', stage: 'active_conversation', nextAction: 'Llamada', nextActionDue: d(-2), updatedAt: `${d(-5)}T08:00:00Z` },
    { id: 'c3', athleteId: 'a2', institution: 'Westbrook', stage: 'evaluation_visit', nextAction: 'Visita oficial', nextActionDue: d(5), updatedAt: `${d(-3)}T08:00:00Z` },
    { id: 'c4', athleteId: 'a2', institution: 'Harbor', stage: 'shortlisted', nextAction: null, nextActionDue: d(0), updatedAt: `${d(-8)}T08:00:00Z` },
    { id: 'c5', athleteId: 'a2', institution: 'Ridge', stage: 'closed', nextAction: 'x', nextActionDue: d(-9), updatedAt: `${d(-30)}T08:00:00Z` },
    { id: 'c6', athleteId: 'a1', institution: 'Pine', stage: 'committed', nextAction: null, nextActionDue: null, updatedAt: `${d(-30)}T08:00:00Z` },
  ],
  tasks: [{ id: 't1', caseId: 'c4', title: 'Pedir expediente', dueDate: d(-1) }, { id: 't2', caseId: 'c5', title: 'cerrado', dueDate: d(-4) }],
  followUps: [{ id: 'f1', athleteId: 'a2', dueDate: d(-1) }, { id: 'f2', athleteId: 'a2', dueDate: d(4) }],
  repAlerts: [{ athleteId: 'a1', text: 'La representación vence en 3 días', daysLeft: 3, severe: true }, { athleteId: 'a2', text: 'Esperando familia', daysLeft: null, severe: false }],
  opportunities: [
    { id: 'p1', title: 'Beca baloncesto', organization: 'Uni', sportId: 'basketball', graduationYears: [2027], deadline: d(40), createdAt: `${d(-2)}T00:00:00Z` },
    { id: 'p2', title: 'Beca tenis', organization: 'Uni', sportId: 'tennis', graduationYears: [], deadline: d(40), createdAt: `${d(-1)}T00:00:00Z` },
    { id: 'p3', title: 'Antigua', organization: 'Uni', sportId: 'volleyball', graduationYears: [], deadline: d(40), createdAt: `${d(-30)}T00:00:00Z` },
    { id: 'p4', title: 'Caducada', organization: 'Uni', sportId: 'basketball', graduationYears: [], deadline: d(-1), createdAt: `${d(-1)}T00:00:00Z` },
  ],
});

test('orden determinista: oferta → vencidos → respuesta → visita → oportunidad nueva', () => {
  const items = buildAttention(base(), NOW);
  const ranks = items.map((i) => i.rank);
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks, 'ordenado por rango');
  assert.equal(items[0].key, 'offer:o1');
  assert.deepEqual(items.map((i) => i.kind), ['offer_expiring', 'overdue', 'overdue', 'overdue', 'overdue', 'university_reply', 'visit', 'new_opportunity']);
  // Mismo resultado aunque las fuentes lleguen en otro orden.
  const shuffled = base();
  for (const k of ['offers', 'cases', 'tasks', 'followUps', 'opportunities'] as const) (shuffled[k] as unknown[]).reverse();
  assert.deepEqual(buildAttention(shuffled, NOW).map((i) => i.key), items.map((i) => i.key));
});

test('reglas: fuera de ventana, cerrados, caducados y otros deportes no aparecen', () => {
  const keys = buildAttention(base(), NOW).map((i) => i.key);
  assert.ok(!keys.includes('offer:o2'), 'oferta a 20 días');
  assert.ok(!keys.includes('offer:o3'), 'oferta ya caducada');
  assert.ok(!keys.includes('case:c5') && !keys.includes('task:t2'), 'proceso cerrado');
  assert.ok(!keys.includes('opp:p2'), 'tenis: la atleta no está activa');
  assert.ok(!keys.includes('opp:p3'), 'oportunidad antigua');
  assert.ok(!keys.includes('opp:p4'), 'oportunidad caducada');
  assert.ok(keys.includes('rep:a1') && !keys.includes('rep:a2'), 'solo alertas de representación graves');
});

test('cada elemento tiene exactamente una acción principal, con destino interno', () => {
  for (const i of buildAttention(base(), NOW)) {
    assert.equal(typeof i.cta.label, 'string');
    assert.ok(i.cta.label.length > 0 && i.cta.href.startsWith('/app/'), i.key);
    assert.equal(Object.keys(i.cta).length, 2);
  }
});

test('el seguimiento interno no expone su texto', () => {
  const f = buildAttention(base(), NOW).find((i) => i.key.startsWith('follow:'))!;
  assert.equal(f.title, 'Seguimiento pendiente');
});

test('el resumen cuadra con las fuentes (recuento independiente)', () => {
  const input = base();
  const items = buildAttention(input, NOW);
  const s = summarize(input, items, NOW);
  assert.equal(s.athletes, input.athletes.filter((a) => a.status === 'active').length);
  assert.equal(s.offers, input.offers.filter((o) => ['a1', 'a2'].includes(o.athleteId) && (o.deadline ?? '9') >= T).length);
  assert.equal(s.needAttention, items.filter((i) => i.rank <= 4).length);
  // Abiertas que encajan con un atleta activo: p1 (baloncesto 2027). p2 tenis (no activa), p3 voleibol sin año → encaja, p4 caducada.
  assert.equal(s.activeOpportunities, 2);
  assert.equal(s.deadlinesToday, items.filter((i) => i.due === T && i.kind !== 'university_reply' && i.kind !== 'new_opportunity').length);
});

test('pipeline en 6 fases: los cerrados no cuentan y el total cuadra', () => {
  const p = pipelineCounts(base().cases);
  assert.deepEqual(p.map((x) => x.label), ['Introducción', 'Evaluación', 'Visita o prueba', 'Oferta', 'Decisión o colocado']);
  assert.equal(p.reduce((n, x) => n + x.count, 0), base().cases.filter((c) => c.stage !== 'closed').length);
});

test('vista previa de atletas: primero quien necesita atención; procesos abiertos y siguiente acción', () => {
  const input = base();
  const rows = athletesPreview(input, buildAttention(input, NOW));
  assert.equal(rows.length, 2, 'solo activos');
  assert.ok(rows.every((r) => r.needsAttention));
  const marcos = rows.find((r) => r.id === 'a1')!;
  assert.equal(marcos.processes, 2);
  assert.equal(marcos.nextAction, 'Llamada');
});

test('estados de plazo', () => {
  assert.equal(dueStateOf(d(-1), T), 'overdue');
  assert.equal(dueStateOf(T, T), 'today');
  assert.equal(dueStateOf(d(2), T), 'soon');
  assert.equal(dueStateOf(d(10), T), 'upcoming');
  assert.equal(Object.keys(ATTENTION_RANK).length, 5);
});

test('/app/go: solo rutas internas de /app', () => {
  assert.equal(safeInternalPath('/app/portfolio/abc?tab=pasos'), '/app/portfolio/abc?tab=pasos');
  for (const bad of ['https://evil.com', '//evil.com', '/app//evil.com', '/\\evil', '/login', '/app/../admin', 'javascript:alert(1)', null]) {
    assert.equal(safeInternalPath(bad as string | null), '/app', String(bad));
  }
});

test('contrato: ningún campo privado (notas, scouting, cumplimiento, contacto) en lo que se envía a la página', async () => {
  const { readFileSync } = await import('node:fs');
  const input = base();
  const items = buildAttention(input, NOW);
  const payload = JSON.stringify({ items, athletes: athletesPreview(input, items), pipeline: pipelineCounts(input.cases), summary: summarize(input, items, NOW) });
  for (const k of ['"body"', '"notes"', '"message"', '"scouting', '"compliance', '"budget', '"email"', '"phone"', '"dateOfBirth"', '"source_text"']) assert.ok(!payload.includes(k), k);
  // El cargador solo pide columnas explícitas y nunca el texto de las notas.
  const loader = readFileSync(new URL('../data/agent-home.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(loader, /select\('\*'\)/);
  assert.doesNotMatch(loader, /\bbody\b/);
  assert.doesNotMatch(loader, /source_text|agency_athlete_notes/);
});
