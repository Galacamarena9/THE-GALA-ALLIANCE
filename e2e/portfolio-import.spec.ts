import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Importar cartera e invitar a reclamarla', () => {
  test('la agencia ve el importador y el estado de cada invitación', async ({ page }) => {
    await page.goto('/preview/portfolio');
    const panel = page.getByTestId('portfolio-import');
    await expect(panel.getByRole('heading', { name: /Trae a tus atletas/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Importar y crear enlaces/ })).toBeVisible();
    await expect(panel.locator('[data-invite-status="claimed"]')).toContainText('Ya está dentro');
    await expect(panel.locator('[data-invite-status="opened"]')).toContainText('La ha abierto');
    await expect(panel).toContainText('de 3 ya están dentro');
    const a11y = await new AxeBuilder({ page }).include('[data-testid="portfolio-import"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(a11y.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  });

  test('un enlace mal formado o caducado se explica sin datos de nadie', async ({ page }) => {
    await page.goto('/invite/agencia/no-es-un-token');
    await expect(page.getByText(/Este enlace ya no es válido/)).toBeVisible();
    await page.goto(`/invite/agencia/${'a'.repeat(64)}`);
    await expect(page.getByText(/Este enlace ya no es válido/)).toBeVisible();
  });
});
