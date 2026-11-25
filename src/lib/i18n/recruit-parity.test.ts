import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeT } from './t.ts';
import { EN } from './en.ts';
import { coachActions, funnel, INFO_KIND_LABEL, INTERNAL_STAGE_LABEL, ROLE_LABEL } from '../domain/recruit.ts';

/** Fase 4b (U2): las pantallas de recruiting no se quedan a medias en inglés. */
const en = makeT('en');
const es = makeT('es');
const translated = (s: string) => en(s) !== s || /^[A-Z][\w' ]*$/.test(s) && EN[s] === s;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : [];
  });
}

test('cada texto marcado con tx() en las pantallas de recruiting tiene traducción', () => {
  const missing: string[] = [];
  for (const f of [...files('src/app/app/recruit'), ...files('src/components/recruit')]) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/tx\('((?:[^'\\]|\\.)*)'\)/g)) {
      const k = m[1].replace(/\\'/g, "'");
      if (!(k in EN)) missing.push(`${f}: ${k}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('etapas, roles y solicitudes de información salen en inglés', () => {
  for (const v of [...Object.values(INTERNAL_STAGE_LABEL), ...Object.values(ROLE_LABEL), ...Object.values(INFO_KIND_LABEL)]) {
    assert.ok(v in EN, v);
  }
  for (const s of funnel(['new', 'offer'])) assert.ok(s.label in EN, s.label);
});

test('las acciones del coach (con cifras y nombres) se traducen enteras', () => {
  const actions = coachActions({
    verified: false, hasPrograms: false, activeNeeds: 0, newApplications: 2, toReview: 1, overdueTasks: 3, dueTodayTasks: 1,
    expiringOpportunities: [{ id: 'o', title: 'Beca 2027', days: 1 }], sharedInfo: 2, members: 1,
    trialApplications: [{ id: 't', title: 'Trial junio', count: 4 }], upcomingTrial: { id: 'u', title: 'Trial de verano', hours: 10, confirmed: 3, missingDocs: 1 },
  });
  for (const a of actions) {
    assert.notEqual(en(a.title), a.title, a.title);
    assert.notEqual(en(a.reason), a.reason, a.reason);
  }
  assert.equal(en('Beca 2027 caduca en 1 día'), 'Beca 2027 expires in 1 day');
  assert.equal(en('3 confirmados · 1 con documentos pendientes. Prepara la lista y el check-in.'), '3 confirmed · 1 with pending documents. Prepare the list and check-in.');
  assert.equal(en('1 atleta'), '1 athlete');
  assert.equal(en('Altura ≥ 1.80 m'), 'Height ≥ 1.80 m');
});

test('en castellano el traductor no cambia nada', () => {
  assert.equal(es('Descubrir atletas'), 'Descubrir atletas');
  assert.equal(es('Beca 2027 caduca en 1 día'), 'Beca 2027 caduca en 1 día');
  assert.equal(translated('Descubrir atletas'), true);
});
