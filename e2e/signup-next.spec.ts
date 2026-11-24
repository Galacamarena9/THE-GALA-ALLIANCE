import { test, expect } from '@playwright/test';

const tok = 'a'.repeat(64);

test.describe('El alta conserva a dónde volver (invitación de agencia)', () => {
  test('la invitación viaja por el formulario y por el enlace de «Entrar»', async ({ page }) => {
    await page.goto(`/signup?role=athlete&next=${encodeURIComponent(`/invite/agencia/${tok}`)}`);
    await expect(page.locator('input[type="hidden"][name="next"]')).toHaveValue(`/invite/agencia/${tok}`);
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/invite/agencia/${tok}`)}`);
  });

  test('un destino externo o raro se descarta', async ({ page }) => {
    for (const bad of ['//evil.com', '/\\evil.com', '/legal/terminos', 'https://evil.com']) {
      await page.goto(`/signup?role=athlete&next=${encodeURIComponent(bad)}`);
      await expect(page.locator('input[type="hidden"][name="next"]')).toHaveCount(0);
    }
  });
});
