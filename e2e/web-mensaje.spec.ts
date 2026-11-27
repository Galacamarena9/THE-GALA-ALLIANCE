import { test, expect, type Page } from '@playwright/test';

/** Web: mensaje honesto por audiencia, demo con deportes del piloto, vocabulario único de fases y metadatos SEO únicos. */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

const AUDIENCE_CTA: [string, RegExp][] = [
  ['/para/agentes', /\/signup\?role=agent&plan=agent_solo$/],
  ['/para/atletas', /\/signup\?role=athlete$/],
  ['/para/familias', /\/signup\?role=parent$/],
  ['/para/clubes', /\/signup\?role=coach$/],
  ['/para/universidades', /\/signup\?role=university$/],
  ['/para/coaches', /\/signup\?role=coach$/],
  ['/para/marcas', /\/signup\?role=brand$/],
];

test.describe('mensaje por audiencia', () => {
  for (const [path, href] of AUDIENCE_CTA) {
    test(`${path}: su propuesta y su alta con rol`, async ({ page }) => {
      await open(page, path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByTestId('audience-primary')).toHaveAttribute('href', href);
      await expect(page.getByTestId('audience-price')).toBeVisible();
    });
  }

  test('ninguna página pública desprestigia a las agencias (son el cliente)', async ({ page }) => {
    for (const path of ['/para/familias', '/para/universidades', '/para/coaches', '/inversores']) {
      await open(page, path);
      await expect(page.locator('main')).not.toContainText(/cobran miles|intermediar|mejor agente/i);
    }
  });

  test('portada: el CTA destacado es el de agencia y la cifra NCAA enlaza a su fuente', async ({ page }) => {
    await open(page, '/');
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(hero.getByRole('link').first()).toHaveAttribute('href', '/para/agentes');
    await expect(page.locator('a[href^="https://www.ncaa.org/news/2025/3/18/"]')).toHaveCount(1);
    await expect(page.locator('#para-quien a[href="/para/clubes"]')).toHaveCount(1);
  });
});

test.describe('afirmaciones sin respaldo', () => {
  test('/inversores: sin «opera sola», coste cero, «LinkedIn» ni pagos activos', async ({ page }) => {
    await open(page, '/inversores');
    const main = page.locator('main');
    await expect(main).not.toContainText(/Opera sola|coste marginal|LinkedIn|Pagos automáticos integrados|Ingresos desde el primer día/);
    await expect(main).toContainText('La agencia paga.');
    await expect(main).toContainText('sin agencias de pago todavía');
  });
});

test.describe('demo y fases', () => {
  test('demo de agencia: solo baloncesto, fútbol y tenis', async ({ page }) => {
    await open(page, '/demo/agente');
    const main = page.locator('main');
    await expect(main).not.toContainText(/Voleibol|Atletismo|Natación/);
    await expect(main).toContainText('Fútbol');
    await expect(main).toContainText('5 fases');
  });

  test('un solo vocabulario: 5 fases en precios y en /para/agentes, nunca «13 fases»', async ({ page }) => {
    await open(page, '/precios');
    await expect(page.locator('main')).not.toContainText('13 fases');
    await expect(page.locator('main')).toContainText('en 5 fases');
    await open(page, '/para/agentes');
    await expect(page.locator('main')).not.toContainText('13 fases');
    await expect(page.locator('main')).toContainText('5 fases');
  });
});

test.describe('metadatos SEO', () => {
  const PAGES = ['/', '/precios', '/inversores', '/para/agentes', '/para/familias', '/para/clubes', '/oportunidades', '/guia', '/seguridad', '/demo/agente'];
  test('title, description y og únicos y coherentes, con imagen y alt', async ({ page }) => {
    const titles = new Set<string>();
    const ogTitles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      const meta = (sel: string) => page.locator(sel).first().getAttribute('content');
      const ogTitle = await meta('meta[property="og:title"]');
      const desc = await meta('meta[name="description"]');
      expect(title, path).toBeTruthy();
      expect(ogTitle, `${path} og:title`).toBeTruthy();
      expect(await meta('meta[property="og:description"]'), `${path} og:description`).toBe(desc);
      expect(await meta('meta[property="og:image"]'), `${path} og:image`).toBeTruthy();
      expect(await meta('meta[property="og:image:alt"]'), `${path} og:image:alt`).toBeTruthy();
      titles.add(title); ogTitles.add(ogTitle!); descriptions.add(desc!);
      // Ninguna imagen sin atributo alt (las decorativas lo llevan vacío).
      expect(await page.locator('img:not([alt])').count(), `${path} imágenes con alt`).toBe(0);
    }
    expect(titles.size).toBe(PAGES.length);
    expect(ogTitles.size).toBe(PAGES.length);
    expect(descriptions.size).toBe(PAGES.length);
  });
});
