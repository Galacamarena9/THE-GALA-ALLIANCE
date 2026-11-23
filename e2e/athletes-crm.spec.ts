import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Prompt 6 · «Mis atletas» (preview con datos ficticios y la lógica real). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
const table = (page: Page) => page.getByRole('table');
const rowsOf = (page: Page) => table(page).locator('tbody tr');

test.describe('Mis atletas', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'escritorio'));

  test('búsqueda: el atleta esperado aparece en ≤ 300 ms tras la respuesta del servidor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/preview/portfolio-100');
    const box = page.getByRole('searchbox', { name: 'Buscar atleta' });
    const ms = await page.evaluate(async () => {
      const input = document.querySelector('input[type="search"]') as HTMLInputElement;
      const t0 = performance.now();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'ejemplo 77');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return await new Promise<number>((resolve) => {
        const check = () => {
          const rows = document.querySelectorAll('table tbody tr');
          if (rows.length === 1 && rows[0].textContent?.includes('ejemplo 77')) resolve(performance.now() - t0);
          else requestAnimationFrame(check);
        };
        check();
      });
    });
    console.log(`búsqueda en memoria (100 atletas): ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThanOrEqual(300);
    await expect(box).toHaveValue('ejemplo 77');
    await expect(page).toHaveURL(/\?q=ejemplo\+77$/);
  });

  test('filtros: vistas canónicas, contadores y estado en la URL (estable al recargar)', async ({ page }) => {
    await open(page, '/preview/portfolio-100');
    const views = page.getByRole('navigation', { name: 'Vistas' });
    await views.getByRole('button', { name: /Necesitan atención/ }).click();
    await expect(page).toHaveURL(/\?view=attention$/);
    const n = Number((await views.getByRole('button', { name: /Necesitan atención/ }).locator('span').first().innerText()).trim());
    await expect(page.getByRole('status')).toContainText(`${n} atletas`);
    // Cada fila de esta vista lleva la marca de atención.
    for (const r of await rowsOf(page).all()) await expect(r.getByRole('img', { name: 'necesita atención' })).toHaveCount(1);
    await views.getByRole('button', { name: /Colocados/ }).click();
    await expect(page).toHaveURL(/\?view=placed$/);
    await page.getByText('Más filtros').click();
    await page.getByLabel('País').selectOption('AR');
    await expect(page).toHaveURL(/view=placed&country=AR/);
    for (const r of await rowsOf(page).all()) await expect(r).toContainText('AR');
  });

  test('siguiente acción visible y una sola acción principal por fila', async ({ page }) => {
    await open(page, '/preview/portfolio');
    const marcos = rowsOf(page).filter({ hasText: 'Marcos Jiménez' });
    await expect(marcos.locator('[data-next]')).toHaveText(/expediente traducido|Lakeshore College|Northfield/);
    for (const r of await rowsOf(page).all()) await expect(r.locator('[data-cta="primary"]')).toHaveCount(1);
    await expect(marcos.getByRole('link', { name: 'Abrir atleta: Marcos Jiménez' })).toHaveAttribute('href', '/app/portfolio/a1');
  });

  test('100 atletas: paginación de 25, orden por columna y sin degradar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const t0 = Date.now();
    await open(page, '/preview/portfolio-100');
    console.log(`carga de la vista con 100 atletas: ${Date.now() - t0} ms (incluye red local)`);
    await expect(rowsOf(page)).toHaveCount(25);
    await expect(page.getByRole('navigation', { name: 'Paginación' })).toContainText('Página 1 de');
    await page.getByRole('navigation', { name: 'Paginación' }).getByRole('button', { name: /Siguiente/ }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByRole('button', { name: 'Atleta' }).click();
    await expect(page.getByRole('columnheader', { name: /Atleta/ })).toHaveAttribute('aria-sort', 'ascending');
    const names = await rowsOf(page).locator('[data-name]').allInnerTexts();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
  });

  test('teclado y lector de pantalla: semántica de tabla y foco', async ({ page }) => {
    await open(page, '/preview/portfolio');
    await expect(table(page).locator('caption')).toContainText('Mis atletas');
    await expect(page.getByRole('columnheader')).toHaveCount(6);
    await expect(page.getByRole('rowheader').first()).toBeVisible();
    // Tab llega a la primera acción de fila con foco visible.
    await page.getByRole('searchbox', { name: 'Buscar atleta' }).focus();
    let found = false;
    for (let i = 0; i < 25 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement?.getAttribute('data-cta') === 'primary');
    }
    expect(found).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  for (const w of [360, 768, 1440]) {
    test(`responsive ${w}px: ${w < 1024 ? 'tarjetas' : 'tabla'} sin desbordar y sin errores graves de accesibilidad`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, '/preview/portfolio-100');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
      if (w < 1024) await expect(page.getByRole('list', { name: 'Atletas' }).getByRole('article')).toHaveCount(25);
      else await expect(rowsOf(page)).toHaveCount(25);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([]);
    });
  }

  test('vacío: invita a buscar talento', async ({ page }) => {
    await open(page, '/preview/portfolio-empty');
    await expect(page.getByText('Tu cartera está vacía')).toBeVisible();
  });
});
