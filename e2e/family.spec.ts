import { test, expect, type Page } from '@playwright/test';

/**
 * Prompt 10 · Family Experience con datos FICTICIOS del probador interno (/preview).
 * Comprueba en móvil y escritorio: la acción de la familia va primero, los plazos distinguen su origen,
 * la verificación no se vende como recomendación y el coste incompleto nunca se presenta como cifra final.
 */
/** El aviso de cookies tapa la parte baja de la pantalla: se cierra antes de interactuar. */
async function dismissCookies(page: Page) {
  const btn = page.getByRole('button', { name: /rechazar opcionales|reject optional/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}
async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

for (const width of [375, 1280]) {
  test.describe(`familia ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('panel: acción de la familia primero, plazos con origen y permisos claros', async ({ page }) => {
      await page.goto('/preview/family-home', { waitUntil: 'networkidle' });
      await dismissCookies(page);
      if (width < 400) await noOverflow(page);
      await expect(page.getByRole('heading', { name: 'Revisa una solicitud de documentos' })).toBeVisible();
      await expect(page.getByText(/Nada se comparte ni se confirma sin tu decisión/)).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Elegir hijo o hija' }).getByRole('link', { name: 'Carlos' })).toBeVisible();
      await expect(page.getByText('Oficial', { exact: true })).toBeVisible();
      await expect(page.getByText('Vuestra', { exact: true })).toBeVisible();
      await expect(page.getByText(/No significa que recomendemos al coach/)).toBeVisible();
      // Permisos y notas están plegados para no saturar: se abren con un clic.
      await page.getByText(/Lo que puedes ver de/).click();
      await expect(page.getByText('Sus notas privadas')).toBeVisible();
      await expect(page.getByText('Nunca', { exact: true })).toBeVisible();
      const saveNote = page.getByRole('button', { name: 'Guardar nota' });
      if (!(await saveNote.isVisible())) await page.getByRole('heading', { name: 'Notas', exact: true }).click();
      await expect(saveNote).toBeVisible();
    });

    test('bienvenida: con quién, qué puede ver, qué aprueba y cómo se protege, en una sola tarjeta', async ({ page }) => {
      await page.goto('/preview/family-welcome', { waitUntil: 'networkidle' });
      if (width < 400) await noOverflow(page);
      await expect(page.getByRole('heading', { name: 'Ya estáis vinculados' })).toBeVisible();
      await expect(page.getByText(/el presupuesto familiar nunca se enseña a nadie/)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Elegir qué avisos recibir' })).toBeVisible();
    });

    test('costes: lo que falta se ve; la opción incompleta no es «la más barata»', async ({ page }) => {
      await page.goto('/preview/family-costs', { waitUntil: 'networkidle' });
      // La comparación se pinta dos veces (tarjetas en móvil, tabla en escritorio); se comprueba la que está visible.
      const shown = (t: string | RegExp, exact = false) => page.getByText(t, { exact }).filter({ visible: true }).first();
      await expect(shown(/Coste estimado para la familia: 24\.200/)).toBeVisible();
      await expect(shown(/Coste conocido hasta ahora: 15\.000.*alojamiento, comidas sin conocer/)).toBeVisible();
      await expect(shown('Por encima del presupuesto')).toBeVisible();
      await expect(shown('Aún no se puede saber', true)).toBeVisible();
      await expect(shown('Desconocido')).toBeVisible();
    });
  });
}
