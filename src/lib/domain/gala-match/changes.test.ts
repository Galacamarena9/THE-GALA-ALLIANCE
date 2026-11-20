import test from 'node:test';
import assert from 'node:assert/strict';
import { explainChange, parseSnapshot, snapshotOf, describeConfidence } from './changes.ts';
import type { Factor, GalaMatch } from './engine.ts';

const factor = (id: string, status: Factor['status'], extra: Partial<Factor> = {}): Factor => ({
  id, dimension: 'academic', kind: 'soft', weight: 10, status, label: id === 'english' ? 'Inglés' : id, detail: '', source: 'passport', ...extra,
});
const match = (score: number | null, confidence: GalaMatch['confidence'], factors: Factor[], version = 'gm-2.0'): GalaMatch => ({
  score, blocked: false, confidence, coverage: 0, dimensions: [{ dimension: 'academic', score, factors }],
  why: [], missing: [], blockers: [], nextStep: null, evidenceGaps: [], version,
});

test('cambios: añadir el certificado de inglés explica la subida', () => {
  const before = snapshotOf(match(82, 'medium', [factor('english', 'unknown', { missingSide: 'athlete' }), factor('program', 'met')]));
  const c = explainChange(before, match(89, 'high', [factor('english', 'met'), factor('program', 'met')]));
  assert.ok(c);
  assert.equal(c.from, 82);
  assert.equal(c.to, 89);
  assert.equal(c.reasons.length, 1);
  assert.match(c.reasons[0].text, /Completaste «Inglés»/);
  assert.equal(describeConfidence(c), 'Confianza: Media → Alta');
});

test('cambios: sin diferencia no hay tarjeta', () => {
  const m = match(80, 'high', [factor('program', 'met')]);
  assert.equal(explainChange(snapshotOf(m), m), null);
});

test('cambios: un dato que publica la universidad no se atribuye al atleta', () => {
  const before = snapshotOf(match(70, 'medium', [factor('program', 'unknown', { missingSide: 'target' })]));
  const c = explainChange(before, match(78, 'medium', [factor('program', 'met')]));
  assert.match(c!.reasons[0].text, /Se publicó información nueva/);
});

test('cambios: si ningún factor lo explica y cambió el motor, se dice así (no se inventa un motivo)', () => {
  const before = snapshotOf(match(70, 'medium', [factor('program', 'met')], 'gm-1.0'));
  const c = explainChange(before, match(74, 'medium', [factor('program', 'met')]));
  assert.equal(c!.reasons.length, 0);
  assert.equal(c!.methodChanged, true);
});

test('cambios: una foto corrupta se ignora', () => {
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot({ v: 'x', c: 'altísima', f: {} }), null);
  assert.ok(parseSnapshot(snapshotOf(match(50, 'low', []))));
});
