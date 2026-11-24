import { test, expect } from '@playwright/test';

test('precios de agencias: programa fundador de 15 plazas, sin la promoción antigua', async ({ page }) => {
  await page.goto('/precios');
  const section = page.locator('section[aria-labelledby="grp-agencias"]');
  await expect(section).toContainText('las 15 primeras agencias pagan un 40 % menos de por vida');
  await expect(section.getByTestId('founder-seats')).toContainText(/15/);
  await expect(section).not.toContainText('31 de marzo de 2027');
  await expect(section).toContainText('79 €/mes');
  await expect(section).toContainText('199 €/mes');
});
