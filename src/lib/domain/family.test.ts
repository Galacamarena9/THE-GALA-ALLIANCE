import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familyNextAction, type FamilyInput } from './family.ts';

const empty: FamilyInput = { today: '2026-11-20', approvals: [], deadlines: [], offers: [], incompleteCosts: 0, missingDocuments: 0, hasAthlete: true };

test('sin atleta vinculado, el primer paso es vincular (no un panel vacío)', () => {
  assert.equal(familyNextAction({ ...empty, hasAthlete: false }).title, 'Vincula a tu hijo o hija');
});

test('la seguridad va primero: un contacto pendiente gana a un documento y a un plazo', () => {
  const a = familyNextAction({ ...empty,
    approvals: [{ kind: 'document', athleteName: 'Lucía', what: 'Universidad X pide el expediente', href: '/app/requests' },
                { kind: 'contact', athleteName: 'Lucía', what: 'Club Y quiere contactar', href: '/app/inbox' }],
    deadlines: [{ date: '2026-11-21', label: 'Cierra la candidatura', athleteName: 'Lucía', kind: 'official', href: '/app/applications' }] });
  assert.equal(a.title, 'Revisa una solicitud de contacto');
  assert.equal(a.urgent, true);
  assert.match(a.why, /Nada se comparte ni se confirma sin tu decisión/);
});

test('una oferta que vence en ≤7 días va antes que un plazo; la decisión es de la familia', () => {
  const a = familyNextAction({ ...empty,
    offers: [{ athleteName: 'Lucía', org: 'Universidad X', deadline: '2026-11-22', href: '/app/offers' }],
    deadlines: [{ date: '2026-11-21', label: 'Cierra la candidatura', athleteName: 'Lucía', kind: 'official', href: '/app/applications' }] });
  assert.equal(a.title, 'Decidid sobre la oferta de Universidad X');
  assert.match(a.why, /en 2 días\. La decisión es vuestra/);
});

test('plazos: oficial antes que personal el mismo día; los pasados no cuentan', () => {
  const a = familyNextAction({ ...empty, deadlines: [
    { date: '2026-11-19', label: 'Ya pasó', athleteName: 'Lucía', kind: 'official', href: '#' },
    { date: '2026-11-25', label: 'Revisión financiera', athleteName: 'Lucía', kind: 'personal', href: '#' },
    { date: '2026-11-25', label: 'Plazo de solicitud', athleteName: 'Lucía', kind: 'official', href: '#' }] });
  assert.equal(a.title, 'Plazo de solicitud');
  assert.equal(a.urgent, true);
});

test('con ofertas y costes incompletos, pedir completar el coste; si no hay nada, «al día»', () => {
  assert.equal(familyNextAction({ ...empty, offers: [{ athleteName: 'L', org: 'U', deadline: null, href: '#' }], incompleteCosts: 2 }).title, 'Completad el coste real de las ofertas');
  assert.equal(familyNextAction(empty).title, 'Estáis al día');
});

import { guardianReview } from './family.ts';

test('revisión al cumplir 18: no aplica a menores ni a vínculos de adulto; ventana de 30 días; confirmar la cierra', () => {
  const base = { today: '2026-11-20', minorLink: true, lastReviewed: null };
  assert.equal(guardianReview({ ...base, dob: '2010-05-01' }).state, 'none', 'menor');
  assert.equal(guardianReview({ ...base, dob: '2008-11-10' }).state, 'due', '18 hace 10 días');
  assert.equal(guardianReview({ ...base, dob: '2008-11-10' }).dueDate, '2026-12-10');
  assert.equal(guardianReview({ ...base, dob: '2007-11-10' }).state, 'lapsed', '19 años sin revisar');
  assert.equal(guardianReview({ ...base, dob: '2007-11-10', lastReviewed: '2026-01-01T10:00:00Z' }).state, 'none', 'ya confirmado tras cumplir 18');
  assert.equal(guardianReview({ ...base, dob: '2007-11-10', lastReviewed: '2025-06-01T10:00:00Z' }).state, 'lapsed', 'revisión anterior a los 18 no cuenta');
  assert.equal(guardianReview({ ...base, dob: '2000-01-01', minorLink: false }).state, 'none', 'vínculo creado siendo adulto');
});

test('bandeja de Aprobaciones: seguridad primero (contacto → documentos → participación)', async () => {
  const { sortApprovals } = await import('./family.ts');
  const out = sortApprovals([
    { kind: 'participation' as const, athleteName: 'Ana' },
    { kind: 'document' as const, athleteName: 'Ana' },
    { kind: 'contact' as const, athleteName: 'Luis' },
    { kind: 'contact' as const, athleteName: 'Ana' },
  ]);
  assert.deepEqual(out.map((a) => `${a.kind}:${a.athleteName}`), ['contact:Ana', 'contact:Luis', 'document:Ana', 'participation:Ana']);
});
