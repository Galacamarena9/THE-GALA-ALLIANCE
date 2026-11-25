import { defineConfig, devices } from '@playwright/test';

/** Pruebas de extremo a extremo sobre el build de producción (sin cuentas reales ni datos personales). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    // El público principal usa la plataforma en castellano; las pruebas en inglés lo piden con test.use({ locale: 'en-US' }).
    locale: 'es-ES',
    // Permite reutilizar un Chromium ya instalado donde no se pueden descargar navegadores.
    ...(process.env.E2E_CHROMIUM ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    env: { ENABLE_PREVIEW: '1' },
    timeout: 120_000,
  },
});
