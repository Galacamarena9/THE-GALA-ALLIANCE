import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC = [
  '/', '/oportunidades', '/oportunidades?v=college', '/oportunidades?v=brands', '/seguridad', '/herramientas', '/precios', '/inversores', '/calculadora', '/guia', '/guia/divisiones-y-becas',
  '/login', '/signup', '/forgot-password', '/legal/privacidad', '/legal/terminos', '/legal/aviso-legal',
  '/para/atletas', '/para/familias', '/para/universidades', '/para/coaches', '/para/agentes', '/para/marcas',
];
// Pantallas internas con datos ficticios (solo existen con ENABLE_PREVIEW=1, nunca en producción).
const PREVIEW = ['agent-home', 'portfolio', 'athlete-home', 'coach-home', 'pipeline', 'pipeline-table', 'match', 'opportunity', 'passport', 'galamatch', 'command-center', 'athlete-pipeline', 'club-trials', 'trial-club', 'trial-athlete', 'family-trials', 'program-athlete', 'family-home', 'family-costs'];
const PROTECTED = [
  '/app', '/app/pipeline', '/app/pipeline/team', '/app/contacts', '/app/portfolio', '/app/athlete/passport',
  '/app/discover', '/app/lists', '/app/inbox', '/app/agents', '/app/collaborations', '/app/trust', '/app/billing', '/app/admin/panel', '/app/plan', '/onboarding',
  '/app/match', '/app/shortlist', '/app/process', '/app/recruit', '/app/recruit/discover', '/app/requests', '/app/universities',
  '/app/portfolio/trials', '/app/ia', '/app/verify', '/app/verify/start', '/app/recruit/trials', '/app/family', '/app/family/costs', '/app/family/safety',
];

async function dismissConsent(page: Page) {
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

async function visitClean(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  expect(res?.status(), `${path} responde`).toBeLessThan(400);
  await dismissConsent(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} sin scroll horizontal`).toBeLessThanOrEqual(2);
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && !i.src.startsWith('data:')).map((i) => i.src));
  expect(broken, `${path} sin imágenes rotas`).toEqual([]);
  expect(errors, `${path} sin errores de JavaScript`).toEqual([]);
}

test.describe('páginas públicas', () => {
  for (const path of PUBLIC) {
    test(`carga bien: ${path}`, async ({ page }) => {
      await visitClean(page, path);
      await expect(page.locator('h1').first()).toBeVisible();
    });
  }
});

test.describe('pantallas del producto (datos ficticios)', () => {
  for (const s of PREVIEW) {
    test(`renderiza: ${s}`, async ({ page }) => {
      await visitClean(page, `/preview/${s}`);
    });
  }
});

test.describe('protección de acceso', () => {
  for (const path of PROTECTED) {
    test(`sin sesión ${path} lleva a login`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toContain(`/login?next=${encodeURIComponent(path)}`);
    });
  }
  for (const path of ['/api/agency/export', '/api/lists/export']) {
    test(`sin sesión ${path} devuelve 401`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401);
    });
  }
  test('sin sesión Gala IA devuelve 401 y no consume modelo', async ({ request }) => {
    const res = await request.post('/api/gala-ia', { data: { mode: 'chat', messages: [{ role: 'user', content: 'hola' }] } });
    expect(res.status()).toBe(401);
  });
});

test.describe('accesibilidad WCAG 2.2 AA', () => {
  for (const path of [...PUBLIC.slice(0, 12), ...PREVIEW.map((s) => `/preview/${s}`)]) {
    test(`sin fallos graves: ${path}`, async ({ page }, info) => {
      test.skip(info.project.name === 'mobile', 'Se audita en escritorio');
      await page.goto(path, { waitUntil: 'networkidle' });
      await dismissConsent(page);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

test('el registro muestra el formulario y no deja enviar vacío', async ({ page }) => {
  await page.goto('/signup', { waitUntil: 'networkidle' });
  await dismissConsent(page);
  const email = page.locator('input[type="email"]').first();
  await expect(email).toBeVisible();
  expect(await email.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
});
