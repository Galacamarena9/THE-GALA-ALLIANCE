import { test, expect, type Page } from '@playwright/test';

/**
 * 11C · Experiencia móvil de trials (scout/club, atleta y familia) con datos FICTICIOS del probador interno.
 * Se comprueba en anchos reales de móvil: sin scroll horizontal, objetivos táctiles cómodos, costes visibles
 * y que ninguna acción importante se ejecuta con un solo toque accidental.
 */
const WIDTHS = [320, 375, 390, 430];

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

for (const width of WIDTHS) {
  test.describe(`móvil ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('trials del club: tarjetas con cifras y una acción principal', async ({ page }) => {
      await page.goto('/preview/club-trials', { waitUntil: 'networkidle' });
      await noOverflow(page);
      await expect(page.getByText('Confirmados').first()).toBeVisible();
      const cta = page.getByRole('link', { name: 'Revisar candidaturas' });
      await expect(cta).toBeVisible();
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });

    test('panel del club: filtros de participantes y aceptar exige confirmación', async ({ page }) => {
      await page.goto('/preview/trial-club', { waitUntil: 'networkidle' });
      await noOverflow(page);
      await expect(page.getByRole('navigation', { name: 'Filtrar participantes' })).toBeVisible();
      await expect(page.getByText('Documentos pendientes').first()).toBeVisible();
      await page.getByRole('button', { name: 'Aceptar' }).first().click();
      // El primer toque solo pide confirmación con el contexto (familia y documentos): no decide nada.
      await expect(page.getByText(/¿Aceptar a Elena.*Familia: pendiente/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toHaveCount(0);
    });

    test('atleta: coste obligatorio y opcional separados antes de inscribirse', async ({ page }) => {
      await page.goto('/preview/trial-athlete', { waitUntil: 'networkidle' });
      await noOverflow(page);
      await expect(page.getByText(/150/).first()).toBeVisible();
      await expect(page.getByText(/Alojamiento/).first()).toBeVisible();
      await expect(page.getByText(/[Oo]pcional/).first()).toBeVisible();
    });

    test('academia: coste obligatorio conocido sin inventar el viaje; aceptar ≠ matricular', async ({ page }) => {
      await page.goto('/preview/program-athlete', { waitUntil: 'networkidle' });
      await noOverflow(page);
      await expect(page.getByText(/Coste obligatorio conocido:\s*12\.750/)).toBeVisible();
      await expect(page.getByText(/Viaje no incluido: coste desconocido/)).toBeVisible();
      await expect(page.getByText(/no significa que tengas una/)).toBeVisible();
      await expect(page.getByText(/Aceptarla no te matricula todavía/)).toBeVisible();
      await page.getByRole('button', { name: 'Aceptar plaza' }).click();
      await expect(page.getByRole('button', { name: 'Confirmar', exact: true })).toBeVisible();
    });

    test('familia: lo que necesita su decisión aparece primero', async ({ page }) => {
      await page.goto('/preview/family-trials', { waitUntil: 'networkidle' });
      await noOverflow(page);
      await expect(page.getByText(/Tu revisión es necesaria/)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Revisar y decidir' })).toBeVisible();
    });
  });
}
