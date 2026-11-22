import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyReport, isMonth, monthLabel, type ReportCase } from './agent-report.ts';

const c = (x: Partial<ReportCase>): ReportCase => ({
  institutionName: 'Drake', stage: 'contacted', nextAction: null, nextActionDue: null, sharedWithAthlete: true,
  updatedAt: '2026-11-10T10:00:00Z', createdAt: '2026-10-01T10:00:00Z', outcomeReason: null, ...x,
});

test('el informe nunca incluye procesos internos (no compartidos con el atleta)', () => {
  const r = buildMonthlyReport({ month: '2026-11', offers: null, cases: [c({ institutionName: 'Secreto', sharedWithAthlete: false }), c({})] });
  assert.equal(r.active, 1);
  assert.equal(r.hiddenInternal, 1);
  assert.ok(![...r.moved, ...r.started].some((x) => x.name === 'Secreto'));
});

test('separa procesos nuevos del mes, avances y compromisos', () => {
  const r = buildMonthlyReport({ month: '2026-11', offers: [], cases: [
    c({ institutionName: 'Nueva', createdAt: '2026-11-03T00:00:00Z', stage: 'research' }),
    c({ institutionName: 'Avanza', stage: 'active_conversation' }),
    c({ institutionName: 'Firmada', stage: 'committed' }),
    c({ institutionName: 'Antigua', updatedAt: '2026-09-01T00:00:00Z' }),
  ] });
  assert.deepEqual(r.started.map((x) => x.name), ['Nueva']);
  assert.deepEqual(r.moved.map((x) => `${x.name}:${x.stage}`), ['Avanza:Conversación activa']);
  assert.deepEqual(r.committed.map((x) => x.name), ['Firmada']);
  assert.equal(r.active, 3, 'comprometido no cuenta como abierto');
});

test('próximos pasos ordenados por fecha, sin fecha al final', () => {
  const r = buildMonthlyReport({ month: '2026-11', offers: null, cases: [
    c({ institutionName: 'B', nextAction: 'Llamar', nextActionDue: null }),
    c({ institutionName: 'A', nextAction: 'Enviar vídeo', nextActionDue: '2026-11-20' }),
  ] });
  assert.deepEqual(r.nextSteps.map((s) => s.name), ['A', 'B']);
});

test('mes válido y etiqueta en castellano', () => {
  assert.ok(isMonth('2026-11') && !isMonth('2026-13') && !isMonth('nov'));
  assert.equal(monthLabel('2026-03'), 'marzo de 2026');
});
