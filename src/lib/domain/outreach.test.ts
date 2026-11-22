import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAutoInvite, filterOutreach, invitationEmail, manualMessage, outreachCounts, parseOutreachFilters, type OutreachContact } from './outreach.ts';

const row = (x: Partial<OutreachContact>): OutreachContact => ({
  id: 'x', segment: 'agency', organizationName: 'Agencia Ñandú', country: 'ES', website: null, channel: 'email', email: 'a@b.test',
  roleTitle: null, sourceUrl: 'https://fuente.test', notes: null, status: 'new', invitedAt: null, respondedAt: null, createdAt: '2026-11-22', ...x,
});

test('invitación: pide permiso, cita la fuente, lleva aceptar/rechazar/baja y escapa el HTML', () => {
  const m = invitationEmail({ organizationName: 'A<b>"', segment: 'university', sourceUrl: 'https://fuente.test/x', respondUrl: 'https://app.test/difusion/abc' });
  assert.ok(m.text.includes('¿Os puedo dar acceso de prueba'));
  assert.ok(m.text.includes('https://fuente.test/x'));
  assert.deepEqual(m.links, { accept: 'https://app.test/difusion/abc?r=accept', decline: 'https://app.test/difusion/abc?r=decline', unsubscribe: 'https://app.test/difusion/abc?r=unsubscribe' });
  for (const l of Object.values(m.links)) assert.ok(m.html.includes(l) && m.text.includes(l));
  assert.ok(!m.html.includes('A<b>'));
  assert.ok(m.html.includes('A&lt;b&gt;&quot;'));
  assert.ok(m.subject.length <= 140);
  assert.ok(!/garantiza|beca asegurada|gratis para siempre/i.test(m.text), 'sin promesas');
});

test('mensaje manual: sin enlaces y con la opción de no volver a escribir', () => {
  const t = manualMessage({ segment: 'club' });
  assert.ok(!/https?:/.test(t));
  assert.ok(t.includes('no lo haremos'));
});

test('solo se invita automáticamente a quien tiene correo y nunca fue contactado', () => {
  assert.equal(canAutoInvite(row({})), true);
  assert.equal(canAutoInvite(row({ status: 'invited' })), false);
  assert.equal(canAutoInvite(row({ status: 'unsubscribed' })), false);
  assert.equal(canAutoInvite(row({ channel: 'web_form', email: null })), false);
  assert.equal(canAutoInvite(row({ channel: 'web_form', email: 'x@y.test' })), false);
});

test('filtros por tipo, estado y búsqueda sin acentos; parámetros no válidos se ignoran', () => {
  const rows = [row({ id: '1' }), row({ id: '2', segment: 'university', organizationName: 'Uni', status: 'accepted' }), row({ id: '3', segment: 'federation', organizationName: 'FBCV', notes: 'Valencia' })];
  assert.deepEqual(filterOutreach(rows, { segment: 'all', status: 'all', q: 'nandu' }).map((r) => r.id), ['1']);
  assert.deepEqual(filterOutreach(rows, { segment: 'university', status: 'all', q: '' }).map((r) => r.id), ['2']);
  assert.deepEqual(filterOutreach(rows, { segment: 'all', status: 'all', q: 'valencia' }).map((r) => r.id), ['3']);
  assert.deepEqual(parseOutreachFilters({ segmento: 'hack', estado: 'accepted', q: 'x'.repeat(200) }), { segment: 'all', status: 'accepted', q: 'x'.repeat(80) });
  const c = outreachCounts(rows);
  assert.equal(c.total, 3);
  assert.equal(c.ready, 2);
  assert.equal(c.interested, 1);
});
