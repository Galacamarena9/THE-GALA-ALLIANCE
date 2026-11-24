import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_PLACEHOLDER, awaitingTooLong, canOutreachFrom, coachEmailDraft, fillLink, mailtoHref, prospectName, replyRate,
} from './coach-outreach.ts';

const base = {
  athleteName: 'Lucía Marín Pérez', minor: false, sportId: 'basketball', gradYear: 2027, position: 'Point guard',
  institutionName: 'State University', coachName: 'John Miller', agencyName: 'Top Agency', senderName: 'Ana Gil',
};

test('plantilla en inglés con saludo al coach, enlace, firma y baja; sin tarifas ni promesas', () => {
  const d = coachEmailDraft(base);
  assert.equal(d.subject, 'European basketball prospect – Lucía Marín Pérez (Point guard, class of 2027)');
  assert.match(d.body, /^Hi Coach Miller,/);
  assert.ok(d.body.includes(LINK_PLACEHOLDER));
  assert.match(d.body, /State University/);
  assert.match(d.body, /rather not receive emails/);
  assert.doesNotMatch(d.body, /fee|scholarship guarantee|represent/i);
});

test('menores: solo nombre e inicial, también en el asunto', () => {
  assert.equal(prospectName('Lucía Marín Pérez', true), 'Lucía M.');
  assert.equal(prospectName('Lucía', true), 'Lucía');
  const d = coachEmailDraft({ ...base, minor: true, coachName: null, position: null, gradYear: null });
  assert.match(d.subject, /Lucía M\. \(upcoming class\)/);
  assert.doesNotMatch(d.body, /Marín/);
  assert.match(d.body, /^Hi Coach,/);
});

test('el enlace sustituye al marcador o se añade al final si el agente lo borró', () => {
  assert.equal(fillLink(`a ${LINK_PLACEHOLDER} b`, 'https://x/r/t'), 'a https://x/r/t b');
  assert.equal(fillLink('Hola  ', 'https://x/r/t'), 'Hola\n\nhttps://x/r/t');
  assert.equal(mailtoHref('c@s.edu', 'A b', 'x&y'), 'mailto:c%40s.edu?subject=A%20b&body=x%26y');
});

test('fases, espera sin respuesta y tasa de respuesta', () => {
  assert.equal(canOutreachFrom('approved_to_contact'), true);
  assert.equal(canOutreachFrom('shortlisted'), false);
  assert.equal(canOutreachFrom('closed'), false);
  const now = new Date('2026-12-20T10:00:00Z');
  assert.equal(awaitingTooLong({ status: 'sent', sentAt: '2026-12-09T10:00:00Z' }, now), true);
  assert.equal(awaitingTooLong({ status: 'sent', sentAt: '2026-12-15T10:00:00Z' }, now), false);
  assert.equal(awaitingTooLong({ status: 'replied', sentAt: '2026-11-01T10:00:00Z' }, now), false);
  assert.deepEqual(replyRate([{ status: 'draft' }, { status: 'sent' }, { status: 'replied' }, { status: 'no_reply' }]), { sent: 3, replied: 1, rate: 1 / 3 });
  assert.deepEqual(replyRate([]), { sent: 0, replied: 0, rate: null });
});

test('presentación natural: promoción, deporte y posición entre paréntesis', () => {
  assert.match(coachEmailDraft(base).body, /introduce Lucía Marín Pérez, a class of 2027 basketball player \(point guard\) who is interested in State University\./);
});
