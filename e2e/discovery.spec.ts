import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Fase 8 · Buscador de oportunidades del agente (probador con datos ficticios y la proyección real). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
const cards = (page: Page) => page.getByTestId('discovery-card');

test.describe('buscador de oportunidades del agente', () => {
  test('empieza por «¿Para quién buscas?» y la atleta elegida', async ({ page }) => {
    await open(page, '/preview/agent-discovery-pick');
    await expect(page.getByRole('heading', { level: 1, name: /para quién buscas/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Atleta' }).getByRole('link')).toHaveCount(2);
    await expect(cards(page)).toHaveCount(0);
    await open(page, '/preview/agent-discovery');
    await expect(page.getByRole('navigation', { name: 'Atleta' }).getByRole('link', { name: /Lucía Martínez/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 2, name: /oportunidades para Lucía/i })).toBeVisible();
  });

  test('no más de cinco filtros a la vista; el resto en «Más filtros»', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const form = page.getByRole('form', { name: 'Filtros' });
    const visible = form.locator('select:visible');
    await expect(visible).toHaveCount(5);
    for (const l of ['Deporte', 'País o destino', 'División o nivel', 'Beca o ayuda', 'Año de ingreso']) await expect(form.getByLabel(l)).toBeVisible();
    await form.getByText('Más filtros').click();
    await expect(form.getByLabel('Tipo de oportunidad')).toBeVisible();
    await expect(form.getByLabel('Elegibilidad')).toBeVisible();
  });

  test('buscar envía solo atleta y filtros permitidos (GET al buscador real)', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const form = page.getByRole('form', { name: 'Filtros' });
    await form.getByLabel('Beca o ayuda').selectOption('partial');
    await form.getByLabel('División o nivel').selectOption('ncaa_d2');
    const req = page.waitForRequest((r) => r.url().includes('/app/opportunities/discover?'));
    await form.getByRole('button', { name: 'Buscar' }).click();
    const url = new URL((await req).url());
    expect(url.searchParams.get('athlete')).toMatch(/^[0-9a-f-]{36}$/);
    expect(url.searchParams.get('aid')).toBe('partial');
    expect(url.searchParams.get('level')).toBe('ncaa_d2');
    expect(url.searchParams.get('sport')).toBe('basketball');
  });

  test('cada tarjeta: un solo CTA principal y la información clave', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const n = await cards(page).count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) {
      const c = cards(page).nth(i);
      await expect(c.getByTestId('review')).toHaveCount(1);
      await expect(c.getByRole('button', { name: 'Revisar', exact: true })).toHaveCount(1);
      await expect(c.getByTestId('fit-badge')).toBeVisible();
      await expect(c.getByText(/Plazo:|Sin plazo publicado/)).toBeVisible();
      // Motivos: como mucho cuatro.
      expect(await c.getByRole('list', { name: 'Por qué encaja' }).getByRole('listitem').count()).toBeLessThanOrEqual(4);
    }
    await expect(cards(page).first().getByText(/Falta saber/)).toBeVisible();
  });

  test('un NO CUMPLE es visiblemente «No elegible» y no se puede añadir a la shortlist', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const bad = page.locator('[data-testid="discovery-card"][data-fit="not_eligible"]');
    await expect(bad).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(bad.nth(i).getByTestId('fit-badge')).toHaveText(/No elegible/);
      await expect(bad.nth(i).getByTestId('ineligible-reason')).toBeVisible();
      await expect(bad.nth(i).getByTestId('shortlist')).toHaveCount(0);
      await expect(bad.nth(i).getByTestId('shortlist-blocked').first()).toBeVisible();
    }
    // Las no elegibles van al final.
    const fits = await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-fit')));
    expect(fits.slice(-2)).toEqual(['not_eligible', 'not_eligible']);
    // «Por qué encaja»: el requisito incumplido aparece como NO CUMPLE y tampoco hay shortlist dentro.
    await bad.first().getByTestId('review').click();
    const drawer = bad.first().getByTestId('why-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-result="FAIL"]')).toHaveCount(1);
    await expect(drawer.locator('[data-result="FAIL"]')).toContainText('No cumple');
    await expect(drawer.getByTestId('shortlist')).toHaveCount(0);
  });

  test('«Por qué encaja»: requisitos CUMPLE / DESCONOCIDO; lo desconocido sigue desconocido', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const withUnknown = cards(page).filter({ hasText: 'Recruiting femenino 2027' });
    await expect(withUnknown.getByTestId('fit-badge')).not.toHaveText(/Encaje fuerte/);
    await withUnknown.getByTestId('review').click();
    const drawer = withUnknown.getByTestId('why-drawer');
    await expect(drawer.getByRole('heading', { name: 'Requisitos obligatorios' })).toBeVisible();
    await expect(drawer.locator('[data-result="UNKNOWN"]')).toHaveCount(2);
    await expect(drawer.locator('[data-result="UNKNOWN"]').first()).toContainText('Desconocido');
    await expect(drawer.locator('[data-result="PASS"]').first()).toContainText('Cumple');
    await expect(drawer.getByRole('heading', { name: 'Confianza de la evidencia' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('filtro «Ocultar no elegibles» y aviso de las ocultas', async ({ page }) => {
    await open(page, '/preview/agent-discovery-eligible');
    await expect(page.locator('[data-fit="not_eligible"]')).toHaveCount(0);
    await expect(page.getByText('2 no elegibles ocultas · mostrar')).toBeVisible();
  });

  test('búsquedas guardadas: la búsqueda activa marca lo nuevo y se puede guardar la actual', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    const saved = page.getByRole('region', { name: 'Búsquedas guardadas' });
    await expect(saved.getByRole('link', { name: /NCAA con beca/ })).toHaveAttribute('aria-current', 'true');
    await expect(saved.getByText(/\d+ nuevas/)).toBeVisible();
    await expect(saved.getByRole('button', { name: 'Guardar búsqueda' })).toBeVisible();
    await expect(cards(page).first().getByText('Nueva')).toBeVisible();
  });

  test('estados vacío, sin acceso y error', async ({ page }) => {
    await open(page, '/preview/agent-discovery-empty');
    await expect(page.getByText('Nada encaja con estos filtros')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quitar filtros' })).toBeVisible();
    await open(page, '/preview/agent-discovery-forbidden');
    await expect(page.getByText('Sin acceso a este perfil')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await open(page, '/preview/agent-discovery-error');
    await expect(page.getByText('No hemos podido cargar las oportunidades')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reintentar' })).toBeVisible();
  });

  test('ningún dato protegido viaja en la red (HTML y carga de React)', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (r) => {
      const ct = r.headers()['content-type'] ?? '';
      if (/text\/(html|x-component|plain)|javascript|json/.test(ct)) bodies.push(await r.text().catch(() => ''));
    });
    await open(page, '/preview/agent-discovery');
    await page.getByTestId('review').first().click();
    const all = bodies.join('\n');
    expect(all.length).toBeGreaterThan(1000);
    // Presupuesto y nota exacta de la atleta ficticia, y columnas internas de oportunidades.
    for (const s of ['77777', '77.777', 'annual_budget', 'budget_private', 'date_of_birth', 'moderation_reason', 'review_note', 'reviewed_by', 'created_by']) {
      expect(all.includes(s), s).toBe(false);
    }
  });

  for (const path of ['/preview/agent-discovery', '/preview/agent-discovery-forbidden']) {
    test(`accesibilidad WCAG 2.1 AA: ${path}`, async ({ page }) => {
      await open(page, path);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }

  test('accesibilidad del panel «Por qué encaja» abierto', async ({ page }) => {
    await open(page, '/preview/agent-discovery');
    await page.getByTestId('review').first().click();
    const axe = await new AxeBuilder({ page }).include('dialog[open]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
