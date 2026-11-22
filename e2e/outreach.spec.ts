import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Lista de difusión (preview con datos ficticios). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
const axeSerious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id);

test.describe('Difusión', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'escritorio'));

  test('lista con resumen, fuente por organización y solo se pueden marcar las invitables', async ({ page }) => {
    await open(page, '/preview/admin-difusion');
    await expect(page.getByRole('heading', { name: 'Difusión', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Resumen de la lista')).toContainText('En la lista16');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(16);
    // Cada organización enlaza su fuente pública.
    await expect(page.locator('tbody a', { hasText: 'Fuente' })).toHaveCount(16);
    // Solo las que tienen correo y estado «Sin contactar» tienen casilla.
    const boxes = page.locator('input[type=checkbox][form="invite-form"]');
    const n = await boxes.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(boxes.nth(i).locator('xpath=ancestor::tr')).toHaveAttribute('data-outreach', 'new');
    }
    await expect(page.locator('tr[data-outreach="unsubscribed"] input[type=checkbox]')).toHaveCount(0);
    await expect(page.getByText('El envío de correo no está configurado')).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });

  test('añadir exige fuente pública y confirmar que es una organización', async ({ page }) => {
    await open(page, '/preview/admin-difusion');
    await expect(page.getByLabel('Página pública donde aparece el contacto')).toHaveAttribute('required', '');
    await expect(page.getByLabel(/Es una organización/)).toHaveAttribute('required', '');
    await expect(page.locator('[data-manual-message]')).not.toContainText('http');
  });

  test('vacía: explica el siguiente paso', async ({ page }) => {
    await open(page, '/preview/admin-difusion-empty');
    await expect(page.locator('[data-empty]')).toContainText('Cargar lista inicial');
  });

  test('respuesta pública: tres opciones por POST, baja visible, sin indexar y accesible', async ({ page }) => {
    await open(page, '/preview/difusion-respuesta');
    await expect(page.getByRole('heading', { name: 'Agencia de ejemplo' })).toBeVisible();
    for (const b of ['Sí, queremos probarla', 'Ahora no, gracias', 'Darme de baja']) await expect(page.getByRole('button', { name: b })).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
    await open(page, '/preview/difusion-hecho');
    await expect(page.getByRole('status')).toContainText('Gala os escribirá');
    const robots = await (await page.request.get('/robots.txt')).text();
    expect(robots).toContain('/difusion/');
  });

  for (const w of [360, 1440]) {
    test(`responsive ${w}px sin desbordar la página`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, '/preview/admin-difusion');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
    });
  }
});
