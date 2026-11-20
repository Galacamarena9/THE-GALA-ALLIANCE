import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, SAT_DATES, TOPICS, TOEFL_CONCORDANCE } from './academy.ts';
import { PLANS } from './plans.ts';

test('cada pregunta de la Academia tiene una respuesta válida y un tema existente', () => {
  const topicIds = new Set(TOPICS.map((t) => t.id));
  for (const q of QUESTIONS) {
    assert.ok(q.answer >= 0 && q.answer < q.options.length, `respuesta fuera de rango en ${q.id}`);
    assert.ok(topicIds.has(q.topicId), `tema inexistente en ${q.id}`);
    assert.equal(TOPICS.find((t) => t.id === q.topicId)?.exam, q.exam, `examen incoherente en ${q.id}`);
    assert.equal(new Set(q.options).size, q.options.length, `opciones duplicadas en ${q.id}`);
  }
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
});

test('los ids de tema cumplen el formato que exige la base de datos', () => {
  for (const t of TOPICS) assert.match(t.id, /^[a-z0-9-]{2,40}$/);
});

test('el calendario SAT está ordenado y cada plazo es anterior al examen', () => {
  for (let i = 0; i < SAT_DATES.length; i++) {
    const s = SAT_DATES[i];
    assert.ok(s.deadline < s.late && s.late < s.test, `plazos incoherentes en ${s.test}`);
    if (i > 0) assert.ok(SAT_DATES[i - 1].test < s.test);
    assert.equal(new Date(`${s.test}T12:00:00Z`).getUTCDay(), 6, `${s.test} no es sábado`);
  }
});

test('la tabla TOEFL 1–6 es la oficial y está ordenada', () => {
  assert.equal(TOEFL_CONCORDANCE[2].legacy, '95–106');
  assert.ok(TOEFL_CONCORDANCE.every((r) => /^\d+–\d+$/.test(r.legacy)));
});

test('planes: códigos válidos y únicos, y el atleta nunca paga por visibilidad', () => {
  assert.equal(new Set(PLANS.map((p) => p.code)).size, PLANS.length);
  for (const p of PLANS) assert.match(p.code, /^[a-z0-9_]{3,40}$/);
  const athlete = PLANS.filter((p) => p.audience === 'athlete');
  assert.ok(athlete.length >= 1 && athlete.every((p) => p.price === '0 €'));
  for (const p of PLANS) assert.ok(!/prioridad|destacad/i.test(p.includes.join(' ')), `${p.code} vende prioridad`);
});

test('los planes de pago automático tienen importe y solo Signature exige trabajo personal', () => {
  for (const p of PLANS.filter((x) => x.cta === 'checkout')) assert.ok(p.checkoutCents && p.checkoutCents > 0 && p.delivery === 'automatic', p.code);
  assert.deepEqual(PLANS.filter((p) => p.delivery === 'personal').map((p) => p.code), ['family_signature']);
  assert.equal(PLANS.find((p) => p.code === 'family_core')?.checkoutCents, 24700);
  assert.equal(PLANS.find((p) => p.code === 'family_elite')?.checkoutCents, 49700);
});

test('la checklist documental calcula fechas antes del 1 de agosto de la promoción', async () => {
  const { DOC_CHECKLIST, DOC_KINDS, suggestedDueDate } = await import('./documents.ts');
  for (const d of DOC_CHECKLIST) assert.ok((DOC_KINDS as readonly string[]).includes(d.kind), d.kind);
  assert.equal(suggestedDueDate('i20', 2027), '2027-04-01');
  assert.equal(suggestedDueDate('highlight_video', 2027), '2025-12-01');
  assert.equal(suggestedDueDate('i20', null), null);
});

test('base de conocimiento: cada capítulo de la guía tiene metadatos de control (sistema, versión, estado)', async () => {
  const { GUIDE } = await import('./guide.ts');
  const { GUIDE_META } = await import('./guide-meta.ts');
  for (const c of GUIDE) {
    const m = GUIDE_META[c.slug];
    assert.ok(m, `faltan metadatos para ${c.slug}`);
    assert.ok(m.version >= 1 && m.systems.length > 0, `metadatos incompletos en ${c.slug}`);
  }
  assert.deepEqual(Object.keys(GUIDE_META).sort(), GUIDE.map((c) => c.slug).sort(), 'metadatos huérfanos');
});
