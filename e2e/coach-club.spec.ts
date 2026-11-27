import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** QA coach-club · Buscador pro, comparar con valores reales y organización pública (preview con datos ficticios). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales|reject optional/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
}

test.describe('buscador del coach y del club', () => {
  test('filtros nuevos: GPA, inglés, test, división, incorporación, abierto a ofertas, NCAA y orden', async ({ page }) => {
    await open(page, '/preview/recruit-discover');
    const form = page.getByRole('form', { name: 'Filtros de búsqueda' });
    for (const l of ['GPA mínimo (estimado, escala 4.0)', 'Nivel de inglés', 'División objetivo', 'Incorporación', 'Promoción', 'Ordenar por']) await expect(form.getByLabel(l)).toBeVisible();
    for (const l of [/Con test de inglés/, /Abierto a ofertas/, /Contacto NCAA ya abierto/]) await expect(form.getByLabel(l)).toBeVisible();
    // Graduados de años anteriores (europeos de 19-20).
    const y = new Date().getUTCFullYear();
    await expect(form.getByLabel('Promoción').locator('option', { hasText: `${y - 3} · ya graduado` })).toHaveCount(1);
    await expect(form).toContainText('Nunca se filtra por presupuesto familiar');
    await expect(form.getByLabel(/presupuesto/i)).toHaveCount(0);
    await form.getByLabel('Nivel de inglés').selectOption('b2');
    await form.getByLabel('GPA mínimo (estimado, escala 4.0)').fill('3.2');
    await form.getByLabel('Ordenar por').selectOption('grad');
    const req = page.waitForRequest((r) => r.url().includes('/preview/recruit-discover?'));
    await form.getByRole('button', { name: 'Aplicar filtros' }).click();
    const url = new URL((await req).url());
    expect(url.searchParams.get('eng')).toBe('b2');
    expect(url.searchParams.get('gpa')).toBe('3.2');
    expect(url.searchParams.get('sort')).toBe('grad');
    await axe(page);
  });

  test('comparar muestra valores reales lado a lado (no solo sí/no)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, '/preview/recruit-compare');
    const table = page.getByTestId('compare-table');
    await expect(table.getByRole('columnheader', { name: /Lucía/ })).toBeVisible();
    for (const v of ['1,78 m', 'Base', '2025', 'TOEFL 96 · C1', '≈ 3.36']) await expect(table).toContainText(v);
    await expect(table.getByRole('link', { name: '▶ Ver highlight' })).toHaveAttribute('href', 'https://example.com/highlight-lucia');
    await expect(table.getByRole('row', { name: /Nota media/ })).toContainText('🔒 No compartido');
    await axe(page);
  });

  test('comparar en inglés y en móvil', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tga_lang', value: 'en', url: baseURL! }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/preview/recruit-compare');
    await expect(page.getByRole('region', { name: 'Grad year' })).toContainText('2025');
    await expect(page.getByRole('region', { name: 'Verification' })).toContainText('Self-reported data only');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});

test.describe('organización pública', () => {
  test('estilo Estadio con deportes, división, ubicación, oportunidades y verificación', async ({ page }) => {
    await open(page, '/preview/org-public');
    await expect(page.getByRole('heading', { level: 1, name: /Demo State University/ })).toBeVisible();
    await expect(page.locator('header.stadium')).toBeVisible();
    const facts = page.getByTestId('org-facts');
    for (const v of ['NCAA D2', 'Great Lakes Valley Conference', 'Baloncesto · Fútbol', 'Springfield, IL', 'Verificada']) await expect(facts).toContainText(v);
    await expect(page.getByRole('heading', { name: /Oportunidades abiertas/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Beca de baloncesto femenino 2027/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Unirme como staff' })).toHaveAttribute('href', '/signup?role=coach');
    await axe(page);
  });

  test('en inglés', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'tga_lang', value: 'en', url: baseURL! }]);
    await open(page, '/preview/org-public');
    await expect(page.getByRole('heading', { name: /Open opportunities/ })).toBeVisible();
    await expect(page.getByTestId('org-facts')).toContainText('Verified');
    await expect(page.getByRole('link', { name: 'Join as staff' })).toBeVisible();
  });
});
