import { test, expect } from '@playwright/test';

/** Fase 5: el tutor firma una declaración y The Gala Alliance la revisa antes de que pueda decidir por un menor. */
test('el tutor sin verificar ve la declaración y no puede enviarla sin marcarla', async ({ page }) => {
  await page.goto('/preview/guardian-verify');
  const card = page.getByTestId('guardian-verification');
  await expect(card.getByRole('heading', { name: 'Confirma que eres su tutor legal' })).toBeVisible();
  await expect(card).toContainText('tutor legal de Lucía (ficticia)');
  await expect(card).toContainText('No te pedimos documentos de identidad');
  const box = card.getByRole('checkbox');
  await expect(box).toHaveAttribute('required', '');
  await expect(card.getByRole('button', { name: 'Firmar y enviar a revisión' })).toBeVisible();
});

test('con la declaración enviada, espera revisión y no vuelve a pedir firma', async ({ page }) => {
  await page.goto('/preview/guardian-pending');
  const card = page.getByTestId('guardian-verification');
  await expect(card.getByRole('heading', { name: 'Revisando tu declaración' })).toBeVisible();
  await expect(card.getByRole('checkbox')).toHaveCount(0);
});

test('administración revisa con motivo obligatorio y sin ver edades ni documentos', async ({ page }) => {
  await page.goto('/preview/guardian-queue');
  const q = page.getByTestId('guardian-review-queue');
  await expect(q).toContainText('Tutores por verificar (2)');
  await expect(q.getByText('Revisar con más cuidado')).toBeVisible();
  await expect(q.getByRole('textbox').first()).toHaveAttribute('minlength', '10');
  await expect(q.getByRole('button', { name: 'Verificar' })).toHaveCount(2);
  await expect(q).not.toContainText(/años|fecha de nacimiento|DNI|pasaporte/i);
});
