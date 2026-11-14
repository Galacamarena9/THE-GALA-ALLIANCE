import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, isEduEmail, linkState, shareTexts, videoEmbed } from './recruiting.ts';

const now = new Date('2026-11-14T12:00:00Z');

test('acceso de coach: solo correos de dominio .edu', () => {
  assert.equal(isEduEmail('coach@gonzaga.edu'), true);
  assert.equal(isEduEmail('Coach.Smith@Athletics.Stanford.EDU'), true);
  assert.equal(isEduEmail('coach@gmail.com'), false);
  assert.equal(isEduEmail('coach@edu.com'), false);
  assert.equal(isEduEmail('coach@fake.edu.es'), false);
  assert.equal(isEduEmail('not-an-email.edu'), false);
});

test('vídeo: YouTube y Vimeo se incrustan; el resto, enlace', () => {
  assert.deepEqual(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoEmbed('https://youtu.be/dQw4w9WgXcQ?t=10'), { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
  assert.deepEqual(videoEmbed('https://vimeo.com/123456789'), { kind: 'embed', src: 'https://player.vimeo.com/video/123456789?dnt=1' });
  assert.deepEqual(videoEmbed('https://www.hudl.com/video/3/123/abc'), { kind: 'link', src: 'https://www.hudl.com/video/3/123/abc' });
  assert.equal(videoEmbed(null), null);
  assert.equal(videoEmbed('javascript:alert(1)'), null);
  assert.equal(videoEmbed('http://youtube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('estado del enlace: activo, caducado o revocado', () => {
  assert.equal(linkState({ expires_at: '2026-12-01T00:00:00Z', revoked_at: null }, now), 'active');
  assert.equal(linkState({ expires_at: '2026-11-01T00:00:00Z', revoked_at: null }, now), 'expired');
  assert.equal(linkState({ expires_at: '2026-12-01T00:00:00Z', revoked_at: '2026-11-10T00:00:00Z' }, now), 'revoked');
  assert.equal(daysLeft('2026-11-24T12:00:00Z', now), 10);
  assert.equal(daysLeft('2026-11-01T00:00:00Z', now), 0);
});

test('mensajes para compartir: inglés, con enlace y sin datos sensibles', () => {
  const t = shareTexts({ name: 'Marcos Jiménez', sport: 'Basketball', position: 'Point guard', gradYear: 2027, url: 'https://x.app/r/abc' });
  assert.match(t.emailSubject, /Marcos Jiménez/);
  assert.match(t.emailSubject, /2027/);
  assert.match(t.emailBody, /https:\/\/x\.app\/r\/abc/);
  assert.match(t.whatsapp, /https:\/\/x\.app\/r\/abc/);
  assert.match(t.mailto, /^mailto:\?subject=/);
  assert.match(t.whatsappHref, /^https:\/\/wa\.me\/\?text=/);
  assert.doesNotMatch(t.emailBody, /budget|presupuesto/i);
});
