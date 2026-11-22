import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Prompt 5 · Inicio del agente (preview con datos ficticios y la lógica real). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
const only = (name: string) => (_: unknown, info: { project: { name: string } }) => test.skip(info.project.name !== name, name);

test.describe('Inicio del agente', () => {
  test.beforeEach(({}, info) => only('desktop')({}, info));

  test('1280×720: la acción crítica se ve sin desplazarse (con la cabecera de 64 px de la app)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await open(page, '/preview/agent-home');
    const first = page.locator('#hoy li[data-kind]').first();
    await expect(first).toHaveAttribute('data-kind', 'offer_expiring');
    const cta = first.locator('[data-cta="primary"]');
    const box = await cta.boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(720 - 64);
  });

  test('cada elemento tiene exactamente una acción principal, con destino interno registrado', async ({ page }) => {
    await open(page, '/preview/agent-home');
    const rows = page.locator('#hoy li[data-kind]');
    const n = await rows.count();
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) {
      const ctas = rows.nth(i).locator('a, button');
      await expect(ctas).toHaveCount(1);
      expect(await ctas.first().getAttribute('href')).toMatch(/^\/app\/go\?k=[a-z_]+&to=%2Fapp%2F/);
    }
  });

  test('el resumen cuadra con la lista: «Necesitan atención» = elementos accionables', async ({ page }) => {
    await open(page, '/preview/agent-home');
    const actionable = await page.locator('#hoy li[data-kind]:not([data-kind="new_opportunity"])').count();
    const shown = await page.getByRole('region', { name: 'Resumen' }).getByRole('link', { name: /Necesitan atención/ }).locator('span').nth(1).innerText();
    expect(Number(shown)).toBe(actionable);
    await expect(page.getByRole('region', { name: 'Procesos por fase' }).locator('ol > li')).toHaveCount(6);
  });

  test('acción común en ≤ 2 clics: abrir un atleta desde Mis atletas', async ({ page }) => {
    await open(page, '/preview/agent-home');
    const link = page.getByRole('region', { name: 'Mis atletas' }).getByRole('link', { name: /Marcos Jiménez/ });
    expect(await link.getAttribute('href')).toMatch(/^\/app\/portfolio\/a1$/);
  });

  test('estados: vacío, parcial, sin agencia y error', async ({ page }) => {
    await open(page, '/preview/agent-home-empty');
    await expect(page.getByText('Tu cartera está vacía')).toBeVisible();
    await open(page, '/preview/agent-home-partial');
    await expect(page.getByText(/No hemos podido cargar ofertas/)).toBeVisible();
    await expect(page.locator('#hoy')).toBeVisible();
    await open(page, '/preview/agent-home-no-agency');
    await expect(page.getByText('Aún no tienes agencia')).toBeVisible();
    await open(page, '/preview/agent-home-error');
    await expect(page.getByRole('alert').filter({ hasText: 'No hemos podido cargar tu inicio' })).toBeVisible();
  });

  for (const w of [360, 768, 1440]) {
    test(`responsive ${w}px sin desbordar y sin errores de accesibilidad graves`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, '/preview/agent-home');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }

  test('móvil: Hoy → Mis atletas → Mensajes → Pipeline, y el resumen al final', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, '/preview/agent-home');
    const y = async (sel: ReturnType<Page['locator']>) => (await sel.boundingBox())!.y;
    const hoy = await y(page.locator('#hoy'));
    const ath = await y(page.getByRole('region', { name: 'Mis atletas' }));
    const msg = await y(page.getByRole('link', { name: /Mensajes/ }).first());
    const pipe = await y(page.getByRole('region', { name: 'Procesos por fase' }));
    const sum = await y(page.getByRole('region', { name: 'Resumen' }));
    expect(hoy < ath && ath < msg && msg < pipe && pipe < sum).toBe(true);
  });
});
