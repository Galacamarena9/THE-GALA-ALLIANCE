import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentStatus, DOC_STATUS_LABEL } from './documents.ts';

const today = new Date('2026-11-16T12:00:00Z');
test('sin archivo: falta, o vencido si pasó la fecha límite', () => {
  assert.equal(documentStatus({ uploaded_at: null, due_date: null, expires_on: null }, today), 'missing');
  assert.equal(documentStatus({ uploaded_at: null, due_date: '2026-12-01', expires_on: null }, today), 'missing');
  assert.equal(documentStatus({ uploaded_at: null, due_date: '2026-11-10', expires_on: null }, today), 'overdue');
});
test('con archivo: subido, caduca pronto (60 días) o caducado', () => {
  const up = '2026-10-01T00:00:00Z';
  assert.equal(documentStatus({ uploaded_at: up, due_date: '2026-11-10', expires_on: null }, today), 'uploaded');
  assert.equal(documentStatus({ uploaded_at: up, due_date: null, expires_on: '2027-06-01' }, today), 'uploaded');
  assert.equal(documentStatus({ uploaded_at: up, due_date: null, expires_on: '2026-12-20' }, today), 'expiring');
  assert.equal(documentStatus({ uploaded_at: up, due_date: null, expires_on: '2026-11-15' }, today), 'expired');
});
test('cada estado tiene etiqueta en español', () => {
  for (const s of ['missing', 'overdue', 'uploaded', 'expiring', 'expired'] as const) assert.ok(DOC_STATUS_LABEL[s].label);
});
