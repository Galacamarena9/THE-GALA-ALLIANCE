import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Prompt 7 · Ficha 360 del atleta (preview con datos ficticios y la lógica real). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Secciones de la ficha' });
const journey = (page: Page) => page.getByRole('region', { name: 'Recorrido actual' });
const axeSerious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id);

test.describe('Ficha 360 del atleta', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'escritorio'));

  test('estado y siguiente acción visibles sin desplazarse, con un único botón principal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const t0 = Date.now();
    await open(page, '/preview/athlete-360');
    const j = journey(page);
    await expect(j).toBeVisible();
    await expect(j.locator('[data-journey-next]')).toHaveText('Oferta de Lakeshore College caduca');
    await expect(j).toContainText('Lakeshore College');
    await expect(j).toContainText('Oferta');
    await expect(j).toContainText('En 2 días');
    await expect(j).toContainText('El atleta');
    const cta = page.locator('[data-cta="primary"]');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveText(/Resolver ahora/);
    await expect(cta).toHaveAttribute('href', '/app/portfolio/a1?tab=oportunidades');
    // Todo el recorrido cabe en la primera pantalla (sin scroll) a 1280×720.
    const box = await j.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
    console.log(`ficha 360 lista en ${Date.now() - t0} ms (red local)`);
  });

  test('cabecera: identidad, verificación, datos clave y acciones Mensaje / Buscar oportunidades / Más', async ({ page }) => {
    await open(page, '/preview/athlete-360');
    const h = page.locator('[data-a360="header"]');
    await expect(h.getByRole('heading', { level: 1 })).toHaveText('Marcos Jiménez');
    await expect(h).toContainText('Baloncesto · Base');
    await expect(h).toContainText('Promoción 2027');
    await expect(h).toContainText('Stats validadas · vídeo');
    await expect(h).toContainText(/Datos clave: \d de 8/);
    const actions = page.getByRole('group', { name: 'Acciones del atleta' });
    await expect(actions.getByRole('link', { name: 'Mensaje' })).toHaveAttribute('href', '/app/inbox/cr1');
    await expect(actions.getByRole('link', { name: 'Buscar oportunidades' })).toHaveAttribute('href', '/app/opportunities/discover?athlete=a1');
    await actions.getByText('Más').click();
    await expect(actions.getByRole('link', { name: 'Perfil público' })).toBeVisible();
  });

  test('fuentes oficiales: enlaces reconocidos y búsqueda en federación, FIBA, NCAA, ESPN y EuroLeague', async ({ page }) => {
    await open(page, '/preview/athlete-360');
    const panel = page.locator('[data-a360="official"]');
    await expect(panel.getByRole('list', { name: 'Enlaces oficiales del atleta' }).getByRole('listitem')).toHaveCount(2);
    await expect(panel).toContainText('Federación (España)');
    await expect(panel).toContainText('Ficha en FIBA');
    await expect(panel).toContainText('1 enlace más');
    const search = panel.getByRole('list', { name: 'Buscar en fuentes oficiales' }).getByRole('link');
    await expect(search).toHaveText([/Federación \(España\)/, /FIBA/, /NCAA/, /ESPN/, /EuroLeague/]);
    for (let i = 0; i < 5; i++) await expect(search.nth(i)).toHaveAttribute('rel', /noopener/);
  });

  test('pestañas accesibles y con URL propia', async ({ page }) => {
    await open(page, '/preview/athlete-360?tab=documentos');
    const nav = tabs(page);
    await expect(nav.getByRole('link')).toHaveText([/Resumen/, /Oportunidades/, /Recruiting/, /Documentos/, /Actividad/]);
    await expect(nav.getByRole('link', { name: /Documentos/ })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    for (const [id, href] of [['resumen', '/app/portfolio/a1'], ['recruiting', '/app/portfolio/a1?tab=recruiting'], ['actividad', '/app/portfolio/a1?tab=actividad']]) {
      await expect(nav.locator(`#tab-${id}`)).toHaveAttribute('href', href);
    }
    await expect(page.locator('[data-a360-panel="documentos"]')).toHaveAttribute('aria-labelledby', 'tab-documentos');
    // Teclado: Tab llega a las pestañas.
    await nav.getByRole('link', { name: /Resumen/ }).focus();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: /Oportunidades/ })).toBeFocused();
    expect(await axeSerious(page)).toEqual([]);
  });

  test('documentos: lista humana con estado real y evidencias', async ({ page }) => {
    await open(page, '/preview/athlete-360?tab=documentos');
    await expect(page.locator('[data-doc="transcript"]')).toHaveAttribute('data-state', 'shared');
    await expect(page.locator('[data-doc="english_test"]')).toHaveAttribute('data-state', 'requested');
    await expect(page.locator('[data-doc="ds160"]')).toHaveAttribute('data-state', 'not_shared');
    await expect(page.getByText('2 de 12 compartidos con tu agencia.')).toBeVisible();
    await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Evidencias' }) }).last()).toContainText('Validadas por su club');
  });

  test('sin permisos: ni ofertas ni estado de documentos, y lo explica', async ({ page }) => {
    await open(page, '/preview/athlete-360-locked?tab=documentos');
    await expect(page.locator('[data-state="shared"]')).toHaveCount(0);
    await expect(page.locator('[data-state="locked"]')).toHaveCount(12);
    await expect(page.getByText(/no te ha dado permiso para ver sus documentos/)).toBeVisible();
    await open(page, '/preview/athlete-360-locked?tab=oportunidades');
    await expect(page.getByText('Sin permiso para ver ofertas')).toBeVisible();
  });

  test('actividad según el rol: un «solo lectura» no recibe el texto de las notas internas', async ({ page }) => {
    await open(page, '/preview/athlete-360?tab=actividad');
    await expect(page.getByRole('list', { name: 'Actividad del atleta' })).toContainText('Prefiere costa este');
    const html = await (await page.request.get('/preview/athlete-360-viewer?tab=actividad')).text();
    expect(html).not.toContain('Prefiere costa este');
    expect(html).not.toContain('quiere ver un partido completo');
    await open(page, '/preview/athlete-360-viewer?tab=actividad');
    await expect(page.getByText('Nota interna: tu rol no permite leer su contenido.').first()).toBeVisible();
    await expect(page.getByText('Tu rol es de solo lectura: no puedes añadir notas.')).toBeVisible();
  });

  test('vacíos con siguiente acción útil', async ({ page }) => {
    await open(page, '/preview/athlete-360-empty');
    await expect(journey(page)).toContainText('Todavía no hay procesos abiertos');
    await expect(page.locator('[data-cta="primary"]')).toHaveText(/Buscar oportunidades/);
    for (const [tab, text] of [['recruiting', 'Abrir el primer proceso'], ['oportunidades', 'Todavía no hay ofertas']]) {
      await open(page, `/preview/athlete-360-empty?tab=${tab}`);
      await expect(page.locator('[data-empty]').filter({ hasText: text }).first()).toBeVisible();
    }
    await open(page, '/preview/athlete-360-empty?tab=documentos');
    await expect(page.getByText('Todavía no te ha compartido ningún documento.')).toBeVisible();
  });

  for (const w of [360, 768, 1440]) {
    test(`responsive ${w}px: sin desbordar y sin errores graves de accesibilidad`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      for (const tab of ['resumen', 'recruiting', 'actividad']) {
        await open(page, `/preview/athlete-360?tab=${tab}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), tab).toBeLessThanOrEqual(2);
        await expect(journey(page)).toBeVisible();
        expect(await axeSerious(page), tab).toEqual([]);
      }
    });
  }
});
