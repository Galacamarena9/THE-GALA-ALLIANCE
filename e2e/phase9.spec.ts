import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Fase 9 · Procesos, mensajes y documentos (probador con datos ficticios y el motor real de siguiente acción). */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: /rechazar opcionales/i });
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

test.describe('fase 9 · procesos, mensajes y documentos', () => {
  test('pipeline en 5 fases; cada tarjeta: un botón principal y como mucho un bloqueo', async ({ page }) => {
    await open(page, '/preview/pipeline');
    const phases = ['introduction', 'evaluation', 'visit', 'offer', 'placed'];
    for (const p of phases) await expect(page.getByTestId(`phase-${p}`)).toBeVisible();
    await expect(page.locator('[data-testid^="phase-"]')).toHaveCount(5);
    for (const l of ['Introducción', 'Evaluación', 'Visita o prueba', 'Oferta', 'Decisión o colocado']) await expect(page.getByRole('heading', { name: l, exact: true })).toBeVisible();
    const cards = page.getByTestId('case-card');
    const n = await cards.count();
    expect(n).toBe(5); // el cerrado no aparece en el tablero
    for (let i = 0; i < n; i++) {
      await expect(cards.nth(i).getByTestId('case-cta')).toHaveCount(1);
      expect(await cards.nth(i).getByTestId('blocker').count()).toBeLessThanOrEqual(1);
      await expect(cards.nth(i).getByTestId('next-action')).toHaveCount(1);
    }
    await expect(page.getByText('1 proceso cerrado')).toBeVisible();
  });

  test('estados: bloqueado, vencido, en espera (otra parte) y esta semana', async ({ page }) => {
    await open(page, '/preview/pipeline');
    const byState = (s: string) => page.locator(`[data-testid="case-card"][data-state="${s}"]`);
    await expect(byState('blocked')).toHaveCount(1);
    await expect(byState('blocked').getByTestId('blocker')).toContainText('representación no está activa');
    await expect(byState('overdue')).toHaveCount(1);
    await expect(byState('overdue')).toContainText('Venció hace 2 días');
    await expect(byState('waiting')).toHaveCount(1);
    await expect(byState('waiting')).toContainText('Le toca a la familia');
    await expect(byState('soon').first()).toBeVisible();
    // Orden de trabajo en cada columna: lo bloqueado antes que lo que va bien.
    const intro = page.getByTestId('phase-introduction').getByTestId('case-card');
    await expect(intro.first()).toHaveAttribute('data-state', 'blocked');
  });

  test('vista de tabla: la misma siguiente acción y quién la hace', async ({ page }) => {
    await open(page, '/preview/pipeline-table');
    await expect(page.getByRole('columnheader', { name: 'Siguiente acción' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Quién' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toContainText('Renovar o revisar la representación');
  });

  test('bandeja única: agrupada por atleta, con contexto; lo urgente primero; menores señalados', async ({ page }) => {
    await open(page, '/preview/agent-inbox');
    const groups = page.getByTestId('inbox-group');
    await expect(groups).toHaveCount(3);
    await expect(groups.first().getByRole('heading')).toHaveText(/Daniel Kim/i);
    await expect(groups.first().getByTestId('group-context')).toContainText('Bloqueado');
    const sofia = groups.filter({ hasText: 'Sofía Martín' });
    await expect(sofia.getByText('Menor: la familia ve la conversación')).toBeVisible();
    await expect(sofia.getByRole('link', { name: /Norte Sports Management/ })).toHaveAttribute('href', /^\/app\/inbox\/[0-9a-f-]{36}$/);
  });

  test('conversación: panel de contexto con fase, siguiente acción, documentos y enlaces', async ({ page }) => {
    await open(page, '/preview/agent-thread');
    const ctx = page.getByTestId('thread-context');
    await expect(ctx.getByText('Westbrook State')).toBeVisible();
    await expect(ctx.getByText(/Visita o prueba · En espera/)).toBeVisible();
    await expect(ctx.getByText('Certificado de notas', { exact: false }).first()).toBeVisible();
    await expect(ctx.getByRole('link', { name: 'Ficha 360' })).toHaveAttribute('href', '/app/portfolio/a2');
    await expect(ctx.getByRole('link', { name: 'Oportunidades que encajan' })).toHaveAttribute('href', '/app/opportunities/discover?athlete=a2');
    await expect(page.getByTestId('composer')).toBeVisible();
  });

  test('autoridad revocada: no se puede escribir y se explica por qué', async ({ page }) => {
    await open(page, '/preview/agent-thread-revoked');
    await expect(page.getByTestId('composer')).toHaveCount(0);
    await expect(page.getByTestId('composer-locked')).toBeVisible();
    await expect(page.getByTestId('thread-context').getByRole('status')).toContainText('no puedes escribir');
    await expect(page.getByTestId('thread-context').getByText('Tu permiso no incluye documentos.')).toBeVisible();
  });

  test('documentos en la ficha 360: para qué proceso hacen falta, respaldo y fecha', async ({ page }) => {
    await open(page, '/preview/athlete-360?tab=documentos');
    await expect(page.getByTestId('needed-for').first()).toBeVisible();
    await expect(page.getByTestId('needed-for').first()).toContainText('Lo necesita:');
  });

  test('Golden Path del agente: Hoy → Procesos → acción → Mensajes → contexto → Oportunidades', async ({ page }) => {
    // 1 · Hoy: el agente ve lo que toca y la vista de procesos por fase.
    await open(page, '/preview/agent-home');
    await expect(page.getByRole('region', { name: 'Procesos por fase' }).locator('ol > li')).toHaveCount(5);
    // 2 · Procesos: la tarjeta vencida lleva a hacer la tarea dentro de su proceso.
    await open(page, '/preview/pipeline');
    const overdue = page.locator('[data-testid="case-card"][data-state="overdue"]');
    await expect(overdue.getByTestId('case-cta')).toHaveText('Hacer tarea');
    await expect(overdue.getByTestId('case-cta')).toHaveAttribute('href', /^\/app\/pipeline\/c2$/);
    // 3 · Mensajes: el mismo atleta aparece con la misma acción como contexto.
    await open(page, '/preview/agent-inbox');
    await expect(page.getByTestId('inbox-group').filter({ hasText: 'Marcos Jiménez' }).getByTestId('group-context')).toContainText('Pedir el expediente traducido');
    // 4 · Conversación: contexto y salto a documentos y a oportunidades del atleta.
    await open(page, '/preview/agent-thread');
    const ctx = page.getByTestId('thread-context');
    await expect(ctx.getByRole('link', { name: 'Ver documentos' })).toHaveAttribute('href', '/app/portfolio/a2?tab=documentos');
    // 5 · Oportunidades: buscador explicado para ese atleta (fase 8), con un solo CTA por tarjeta.
    await open(page, '/preview/agent-discovery');
    await expect(page.getByTestId('discovery-card').first().getByTestId('review')).toHaveCount(1);
  });

  for (const path of ['/preview/pipeline', '/preview/agent-inbox', '/preview/agent-thread', '/preview/agent-thread-revoked']) {
    test(`accesibilidad WCAG 2.1 AA: ${path}`, async ({ page }) => {
      await open(page, path);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
