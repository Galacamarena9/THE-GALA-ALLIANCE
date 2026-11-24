import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Escribir al coach desde el proceso', () => {
  test('plantilla en inglés editable, estado de cada email y aviso de los que no contestan', async ({ page }) => {
    await page.goto('/preview/coach-outreach');
    const panel = page.getByTestId('coach-outreach');
    await expect(panel.getByLabel('Asunto (en inglés)')).toHaveValue(/European basketball prospect – Lucía Marín/);
    await expect(panel.getByLabel('Mensaje (en inglés)')).toHaveValue(/\{\{passport_link\}\}/);
    await expect(panel.getByLabel('Mensaje (en inglés)')).toHaveValue(/rather not receive emails/);
    await expect(panel.getByTestId('outreach-rate')).toContainText('2 emails enviados · 1 con respuesta');
    await expect(panel.locator('[data-status="sent"]')).toContainText('Sin respuesta aún');
    await expect(panel.locator('[data-status="replied"]')).toContainText('perfil abierto 3 veces');
    await expect(panel.locator('[data-status="draft"]').getByTestId('outreach-sent')).toBeVisible();
    await panel.getByLabel('Coach', { exact: true }).selectOption({ label: 'Coach Reed · Harbor Tech' });
    await expect(panel.getByLabel('Email del coach')).toHaveValue('coach@harbor.edu');
    const a11y = await new AxeBuilder({ page }).include('[data-testid="coach-outreach"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(a11y.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  });
});
