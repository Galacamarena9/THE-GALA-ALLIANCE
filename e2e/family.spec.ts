import { test, expect, type Page } from '@playwright/test';

/**
 * Prompt 10 · Family Experience con datos FICTICIOS del probador interno (/preview).
 * Comprueba en móvil y escritorio: la acción de la familia va primero, los plazos distinguen su origen,
 * la verificación no se vende como recomendación y el coste incompleto nunca se presenta como cifra final.
 */
async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

for (const width of [375, 1280]) {
  test.describe(`familia ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('panel: acción de la familia primero, plazos con origen y permisos claros', async ({ page }) => {
      await page.goto('/preview/family-home', { waitUntil: 'networkidle' });
      if (width < 400) await noOverflow(page);
      await expect(page.getByRole('heading', { name: 'Revisa una solicitud de documentos' })).toBeVisible();
      await expect(page.getByText(/Nada se comparte ni se confirma sin tu decisión/)).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Elegir hijo o hija' }).getByRole('link', { name: 'Carlos' })).toBeVisible();
      await expect(page.getByText('Oficial', { exact: true })).toBeVisible();
      await expect(page.getByText('Vuestra', { exact: true })).toBeVisible();
      await expect(page.getByText(/No significa que recomendemos al coach/)).toBeVisible();
      await expect(page.getByText('Sus notas privadas')).toBeVisible();
      await expect(page.getByText('Nunca', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Guardar nota' })).toBeVisible();
    });

    test('costes: lo que falta se ve; la opción incompleta no es «la más barata»', async ({ page }) => {
      await page.goto('/preview/family-costs', { waitUntil: 'networkidle' });
      await expect(page.getByText(/Coste estimado para la familia: 24\.200/)).toBeVisible();
      await expect(page.getByText(/Coste conocido hasta ahora: 15\.000.*alojamiento, comidas sin conocer/)).toBeVisible();
      await expect(page.getByText('Por encima del presupuesto')).toBeVisible();
      await expect(page.getByText('Aún no se puede saber', { exact: true })).toBeVisible();
      await expect(page.getByText('Desconocido').first()).toBeVisible();
    });
  });
}
