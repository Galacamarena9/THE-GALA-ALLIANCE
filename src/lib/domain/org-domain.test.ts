import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailDomainMatchesWebsite } from './org-domain.ts';

test('mismo dominio o subdominio con punto: coincide', () => {
  assert.equal(emailDomainMatchesWebsite('harvard.edu', 'harvard.edu'), true);
  assert.equal(emailDomainMatchesWebsite('athletics.harvard.edu', 'harvard.edu'), true);
  assert.equal(emailDomainMatchesWebsite('@Harvard.EDU', 'www.harvard.edu'), true);
  assert.equal(emailDomainMatchesWebsite('harvard.edu.', 'harvard.edu'), true);
});

test('sufijo sin punto o dominio distinto: NO coincide', () => {
  assert.equal(emailDomainMatchesWebsite('fakeharvard.edu', 'harvard.edu'), false);
  assert.equal(emailDomainMatchesWebsite('harvard.edu.evil.com', 'harvard.edu'), false);
  assert.equal(emailDomainMatchesWebsite('gmail.com', 'harvard.edu'), false);
  // La web es un subdominio y el email es el dominio padre: no se da por buena (podría ser un host ajeno).
  assert.equal(emailDomainMatchesWebsite('harvard.edu', 'athletics.harvard.edu'), false);
  assert.equal(emailDomainMatchesWebsite('x.edu', 'edu'), false);
});

test('sin datos: null (no se puede comprobar)', () => {
  assert.equal(emailDomainMatchesWebsite(null, 'harvard.edu'), null);
  assert.equal(emailDomainMatchesWebsite('harvard.edu', null), null);
});
