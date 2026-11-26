import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterSignupPath, safeRedirectPath } from './safe-path.ts';

test('solo rutas internas: fuera dominios, barras invertidas, protocolos y saltos', () => {
  for (const bad of ['//evil.com', '/\\evil.com', '/%5Cevil.com\\', 'https://evil.com', 'javascript:alert(1)', '/app/../../x', '', null, undefined, '/a b']) {
    assert.equal(safeRedirectPath(bad as string), '/app', String(bad));
  }
  assert.equal(safeRedirectPath('/app/pipeline?x=1'), '/app/pipeline?x=1');
  assert.equal(safeRedirectPath('/invite/agencia/' + 'a'.repeat(64)), '/invite/agencia/' + 'a'.repeat(64));
});

test('tras el alta solo se vuelve a invitaciones, oportunidades o la app', () => {
  const tok = 'b'.repeat(64);
  assert.equal(afterSignupPath(`/invite/agencia/${tok}`), `/invite/agencia/${tok}`);
  assert.equal(afterSignupPath('/app'), '/app');
  assert.equal(afterSignupPath('/oportunidades/123'), '/oportunidades/123');
  assert.equal(afterSignupPath('/precios?plan=agent_scale'), '/precios?plan=agent_scale');
  assert.equal(afterSignupPath('/legal/terminos'), null);
  assert.equal(afterSignupPath('//evil.com'), null);
  assert.equal(afterSignupPath('/apple'), null);
});
