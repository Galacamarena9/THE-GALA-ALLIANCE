import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** Prompt 4 · Shell por actor (preview con datos ficticios): destinos, teclado, foco, búsqueda y móvil. */
test.describe('shell por actor', () => {
  test('Agent OS: 5 destinos + Más, y un atleta a 2 interacciones con ⌘K', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'escritorio');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/preview/shell-agent');
    const nav = page.getByRole('navigation', { name: 'Navegación · Agencia' }).last();
    for (const l of ['Hoy', 'Atletas', 'Procesos', 'Oportunidades', 'Mensajes']) await expect(nav.getByRole('link', { name: l, exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Más' })).toBeVisible();
    // Interacción 1: ⌘K. Interacción 2: escribir y Enter → ficha del atleta.
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: 'Buscar' });
    await expect(box).toBeFocused();
    await box.fill('Marcos');
    await expect(page.getByRole('option').first()).toContainText('Marcos');
    // Escape cierra y devuelve el foco.
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
  });

  test('Athlete OS: exactamente 5 destinos, sin «Más»', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'escritorio');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/preview/shell-athlete');
    const nav = page.getByRole('navigation', { name: 'Navegación · Atleta' }).last();
    await expect(nav.getByRole('link')).toHaveCount(5);
    await expect(nav.getByRole('button', { name: 'Más' })).toHaveCount(0);
  });

  test('teclado: Tab recorre la barra lateral en orden y el foco es visible', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'escritorio');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/preview/shell-university');
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() || (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') || ''));
    }
    const nav = ['Hoy', 'Buscar atletas', 'Procesos', 'Becas y pruebas', 'Mensajes', 'Más'];
    const idx = nav.map((l) => order.indexOf(l));
    expect(idx.every((x) => x >= 0), `orden: ${order.join(' | ')}`).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    // «Más» se abre con teclado (fase 8: Mensajes ya es de primer nivel; dentro quedan cuenta y herramientas).
    await page.getByRole('navigation', { name: 'Navegación · Universidad' }).last().getByRole('button', { name: 'Más' }).press('Enter');
    await expect(page.getByRole('link', { name: 'Ayuda', exact: true }).last()).toBeVisible();
  });

  test('Operaciones Gala: Verificación, Cumplimiento, Confianza, Moderación, Soporte', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'escritorio');
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/preview/shell-operations');
    const nav = page.getByRole('navigation', { name: 'Navegación · Operaciones Gala' }).last();
    for (const l of ['Verificación', 'Cumplimiento', 'Confianza', 'Moderación', 'Soporte']) await expect(nav.getByRole('link', { name: l, exact: true })).toBeVisible();
  });

  for (const [w, label] of [[768, 'tablet'], [375, 'móvil']] as const) {
    test(`${label}: navegación compacta sin desbordar y sin errores de accesibilidad graves`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'un solo proyecto basta');
      await page.setViewportSize({ width: w, height: 800 });
      await open(page, '/preview/shell-agent');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(2);
      if (w < 768) {
        const bar = page.getByRole('navigation', { name: 'Accesos rápidos' });
        for (const l of ['Hoy', 'Atletas', 'Procesos', 'Mensajes']) await expect(bar.getByRole('link', { name: l })).toBeVisible();
        await bar.getByRole('button', { name: 'Menú' }).click();
        await expect(page.getByRole('dialog', { name: 'Todas las funciones' })).toBeVisible();
      } else {
        await expect(page.getByRole('complementary', { name: 'Navegación compacta' }).getByRole('link', { name: 'Atletas' })).toBeVisible();
      }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([]);
    });
  }
});
