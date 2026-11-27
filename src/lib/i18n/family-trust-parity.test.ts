import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN } from './en.ts';
import { COST_LABEL, AID_LABEL } from '../domain/family-cost.ts';
import { READINESS_LABEL } from '../domain/readiness.ts';

/** QA familia: avisos, conversaciones en pausa, «Esto me incomoda», coste en euros y a 4 años, informe propio. */
const FILES = [
  'src/components/family/CostComparison.tsx', 'src/components/family/FamilyForms.tsx', 'src/app/app/family/costs/page.tsx',
  'src/app/app/family/page.tsx', 'src/app/print/informe-familia/FamilyOwnReport.tsx', 'src/components/inbox/DiscomfortButton.tsx', 'src/components/inbox/ThreadPausedNotice.tsx',
  'src/app/app/inbox/[id]/page.tsx', 'src/app/actions/connect.ts', 'src/app/actions/family.ts',
];

test('familia: cada texto marcado con tx() en lo tocado tiene su traducción al inglés', () => {
  const missing: string[] = [];
  for (const file of FILES) {
    for (const m of readFileSync(file, 'utf8').matchAll(/tx\('((?:[^'\\]|\\.)*)'\)/g)) {
      const k = m[1].replace(/\\'/g, "'");
      if (!(k in EN)) missing.push(`${file}: ${k}`);
    }
  }
  for (const k of [...Object.values(COST_LABEL), ...Object.values(AID_LABEL), READINESS_LABEL]) if (!(k in EN)) missing.push(k);
  assert.deepEqual(missing, []);
});

test('un solo nombre para el % de perfil completo en las pantallas del atleta y la familia', () => {
  for (const file of ['src/components/dashboard/AthleteCommandCenter.tsx', 'src/app/app/athlete/page.tsx', 'src/app/app/athlete/passport/page.tsx',
    'src/app/app/page.tsx', 'src/app/app/plan/page.tsx']) {
    const src = readFileSync(file, 'utf8');
    assert.ok(src.includes('READINESS_LABEL'), `${file} usa READINESS_LABEL`);
    assert.doesNotMatch(src, /Recruiting Readiness|Opportunity readiness|Passport listo para enviar/, file);
  }
});
