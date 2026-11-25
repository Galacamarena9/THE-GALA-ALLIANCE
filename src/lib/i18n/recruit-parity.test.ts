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

test('portada, precios, alta y login: cada texto marcado, cada plan y cada tipo de cuenta tienen traducción', async () => {
  const pub = ['src/app/page.tsx', 'src/app/precios/page.tsx', 'src/app/(auth)/login/page.tsx', 'src/app/(auth)/login/LoginForm.tsx', 'src/app/(auth)/signup/page.tsx', 'src/app/(auth)/signup/SignupForm.tsx', 'src/components/PublicShell.tsx', 'src/components/PublicMobileMenu.tsx', ...files('src/components/landing/bridge')];
  const missing: string[] = [];
  for (const f of pub) {
    for (const m of readFileSync(f, 'utf8').matchAll(/tx\('((?:[^'\\]|\\.)*)'\)/g)) {
      const k = m[1].replace(/\\'/g, "'");
      if (!(k in EN)) missing.push(`${f}: ${k}`);
    }
  }
  const { PLANS, AUDIENCE_LABEL, VISIBILITY_PROMISE } = await import('../../content/plans.ts');
  const { ACTORS } = await import('../domain/roles.ts');
  for (const p of PLANS) for (const v of [p.name, p.price, p.priceNote, p.pitch, ...p.includes].filter(Boolean) as string[]) if (en(v) === v && !/^[A-Z][a-z]+$/.test(v)) missing.push(`plan ${p.code}: ${v}`);
  for (const v of [...Object.values(AUDIENCE_LABEL), VISIBILITY_PROMISE]) if (!(v in EN)) missing.push(v);
  for (const a of ACTORS) for (const v of [a.label, a.plural, a.promise]) if (!(v in EN)) missing.push(`actor ${a.role}: ${v}`);
  assert.deepEqual(missing, []);
  // Titular partido en dos (texto + palabra destacada): las dos mitades tienen que leerse juntas.
  assert.equal(`${en('Si tienes nivel, tienes que poder')} ${en('optar.')}`, en('Si tienes nivel, tienes que poder optar.'));
  assert.equal(en('Precio fundador −40 % de por vida: quedan 6 de 15 plazas.'), 'Founder price, 40% off for life: 6 of 15 spots left.');
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
