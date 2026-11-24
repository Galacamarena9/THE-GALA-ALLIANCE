import { test, expect } from '@playwright/test';

test('plan de agencia: prueba con días restantes, límite alcanzado y sin plan', async ({ page }) => {
  await page.goto('/preview/plan-trial');
  const trial = page.getByTestId('plan-status');
  await expect(trial).toContainText(/Prueba gratuita: quedan 1[12] días/);
  await expect(trial).toContainText('18 de 100');
  await expect(trial).toContainText('2 de 5');

  await page.goto('/preview/plan-full');
  await expect(page.getByTestId('plan-status')).toContainText('Plan contratado.');
  await expect(page.getByTestId('plan-status')).toContainText('25 de 25');
  await expect(page.getByRole('progressbar', { name: /Atletas/ })).toHaveAttribute('aria-valuenow', '100');

  await page.goto('/preview/plan-none');
  const none = page.getByTestId('plan-status');
  await expect(none).toContainText('La prueba ha terminado. Conservas todo lo que tienes');
  await expect(none).toContainText('7 · sin plan activo');
  await expect(none.getByRole('alert')).toBeVisible();
});
