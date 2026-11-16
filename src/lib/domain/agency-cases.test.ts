import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_STAGES, stageLabel, isCaseStage, nextStage, groupByStage, casesToCsv, csvCell, isCaseStale, AGENCY_ROLES, canWrite, cycleOptions,
} from './agency-cases.ts';

test('hay 13 fases en el orden de la especificación', () => {
  assert.equal(CASE_STAGES.length, 13);
  assert.equal(CASE_STAGES[0].id, 'research');
  assert.equal(CASE_STAGES.at(-1)?.id, 'closed');
  assert.equal(stageLabel('evaluation_visit'), 'Evaluación o visita');
});

test('isCaseStage valida', () => {
  assert.equal(isCaseStage('contacted'), true);
  assert.equal(isCaseStage('signed'), false);
});

test('nextStage avanza y no pasa de las fases finales', () => {
  assert.equal(nextStage('research'), 'fit_review');
  assert.equal(nextStage('decision_pending'), 'committed');
  assert.equal(nextStage('committed'), null);
  assert.equal(nextStage('closed'), null);
});

test('groupByStage devuelve las 13 columnas aunque estén vacías', () => {
  const cols = groupByStage([{ id: 'a', stage: 'contacted' }, { id: 'b', stage: 'contacted' }, { id: 'c', stage: 'research' }]);
  assert.equal(cols.length, 13);
  assert.equal(cols.find((c) => c.stage.id === 'contacted')?.items.length, 2);
  assert.equal(cols.find((c) => c.stage.id === 'closed')?.items.length, 0);
});

test('csvCell escapa comillas, comas, saltos y fórmulas', () => {
  assert.equal(csvCell('hola'), 'hola');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('di "hola"'), '"di ""hola"""');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell(null), '');
});

test('casesToCsv genera cabecera y una fila por proceso', () => {
  const csv = casesToCsv([{ athlete: 'Ana Ruiz', institution: 'Univ, Example', sport: 'Baloncesto', cycle: '2027-28', stage: 'contacted', owner: 'Luis', nextAction: 'Llamar', nextActionDue: '2026-11-20', updatedAt: '2026-11-16T10:00:00Z' }]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Atleta,Universidad/);
  assert.match(lines[1], /"Univ, Example"/);
  assert.match(lines[1], /Contactado/);
});

test('un proceso abierto sin movimiento en 14 días está parado', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  assert.equal(isCaseStale({ stage: 'contacted', updatedAt: '2026-10-30T00:00:00Z' }, now), true);
  assert.equal(isCaseStale({ stage: 'contacted', updatedAt: '2026-11-10T00:00:00Z' }, now), false);
  assert.equal(isCaseStale({ stage: 'closed', updatedAt: '2026-01-01T00:00:00Z' }, now), false);
});

test('roles de agencia: viewer no escribe', () => {
  assert.equal(AGENCY_ROLES.length, 7);
  assert.equal(canWrite('viewer'), false);
  assert.equal(canWrite(null), true);
  assert.equal(canWrite('scout'), true);
});

test('cycleOptions ofrece la temporada actual y las tres siguientes', () => {
  assert.deepEqual(cycleOptions(new Date('2026-11-16')), ['2026-27', '2027-28', '2028-29', '2029-30']);
});
