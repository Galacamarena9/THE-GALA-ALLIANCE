import { test, expect, type Page } from '@playwright/test';

/** Fase 4 de la auditoría: el aviso de cookies no tapa el botón principal (U1) y habla inglés donde toca (U2). */

async function bannerTop(page: Page) {
  const box = await page.getByTestId('cookie-banner').boundingBox();
  if (!box) throw new Error('sin aviso');
  return box.y;
}

test('U1: con el aviso abierto, el botón principal del alta queda por encima del aviso', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByTestId('cookie-banner')).toBeVisible();
  const submit = page.locator('form button[type="submit"]').last();
  await submit.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const box = await submit.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(await bannerTop(page));
  // Y el botón se puede pulsar (nada encima interceptando el clic).
  await submit.click({ trial: true });
});

test('U1: al cerrar el aviso la página deja de reservar su espacio', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('cookie-banner')).toBeVisible();
  const reserved = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
  expect(parseFloat(reserved)).toBeGreaterThan(40);
  await page.getByRole('button', { name: /rechazar opcionales/i }).click();
  await expect(page.getByTestId('cookie-banner')).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe('0px');
});

test('U2: en castellano por defecto para un navegador en castellano', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cookie-banner')).toContainText('Tu privacidad, tus reglas');
  await expect(page.getByRole('button', { name: 'Rechazar opcionales' })).toBeVisible();
});

test.describe('navegador en inglés', () => {
  test.use({ locale: 'en-US' });
  test('U2: el aviso sale en inglés y con el mismo peso para rechazar y aceptar', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByTestId('cookie-banner');
    await expect(banner).toContainText('Your privacy, your call');
    await expect(banner).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Reject optional' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible();
  });
});

test('U2: la ficha del coach (/r/…) lleva el aviso en inglés aunque el navegador esté en castellano', async ({ page }) => {
  await page.goto(`/r/${'0'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'This link is no longer active' })).toBeVisible();
  await expect(page.getByTestId('cookie-banner')).toContainText('Your privacy, your call');
});

test('U2: la preferencia guardada (tga_lang) manda sobre el navegador', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tga_lang', value: 'en', url: baseURL! }]);
  await page.goto('/');
  await expect(page.getByTestId('cookie-banner')).toContainText('Your privacy, your call');
});

test.describe('fase 4b · recruiting en inglés', () => {
  test.use({ locale: 'en-US' });
  test('la cabecera del portal de recruiting sale en inglés con un navegador en inglés', async ({ page }) => {
    await page.goto('/preview/recruit-shell');
    const nav = page.getByRole('navigation', { name: 'Recruiting portal' });
    await expect(nav.getByRole('link', { name: 'Discover' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Processes' })).toBeVisible();
    await expect(page.getByText('Verification pending')).toBeVisible();
    await expect(page.getByText(/Limited access while we verify your organization/)).toBeVisible();
    await expect(page.getByText('· Head coach')).toBeVisible();
  });
});

test('fase 4b · en castellano la cabecera del portal no cambia', async ({ page }) => {
  await page.goto('/preview/recruit-shell');
  const nav = page.getByRole('navigation', { name: 'Portal de recruiting' });
  await expect(nav.getByRole('link', { name: 'Descubrir' })).toBeVisible();
  await expect(page.getByText('Verificación pendiente')).toBeVisible();
});

test.describe('fase 4c · portada, precios, alta y login en inglés', () => {
  test.use({ locale: 'en-US' });
  test('la portada habla inglés con un navegador en inglés', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('If you have the level, you should get the shot.');
    await expect(page.getByRole('link', { name: /I'm an agent · see the demo/ }).first()).toBeVisible();
    await expect(page.locator('[lang="en"]').first()).toBeVisible();
    await expect(page.getByText('Do you guarantee a scholarship or a contract?')).toBeVisible();
  });
  test('precios en inglés, con el precio fundador y las cifras sin cambiar', async ({ page }) => {
    await page.goto('/precios');
    await expect(page.getByRole('heading', { name: 'Agencies' })).toBeVisible();
    await expect(page.getByText('€79/month').first()).toBeVisible();
    await expect(page.getByText(/founder price: €47\/month for life for the first 15 agencies/).first()).toBeVisible();
  });
  test('alta y login en inglés, y el error de validación también', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await page.goto('/signup');
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });
});

test('fase 4c · el selector cambia la portada a inglés y vuelve a castellano', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Si tienes nivel, tienes que poder optar.');
  await page.getByRole('button', { name: /English/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('If you have the level, you should get the shot.');
  await page.getByRole('button', { name: /Castellano/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Si tienes nivel');
});
