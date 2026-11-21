import { chromium } from '/home/claude/the-gala-alliance/node_modules/playwright-core/index.mjs';
const [,, widthsArg, ...routes] = process.argv;
const widths = widthsArg.split(',').map(Number);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const r of routes) {
    const name = r.replace(/^\//, '').replace(/[\/?=&]/g, '_') || 'home';
    try {
      await page.goto('http://localhost:3100' + r, { waitUntil: 'networkidle', timeout: 30000 });
      const btn = page.getByRole('button', { name: 'Rechazar opcionales' });
      if (await btn.isVisible().catch(() => false)) await btn.click();
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await page.screenshot({ path: `/tmp/da/${name}@${w}.png`, fullPage: true });
      console.log(`${r}@${w} ok overflow=${overflow} h=${await page.evaluate(() => document.body.scrollHeight)} status=${page.url().includes('login') ? 'LOGIN' : 'ok'}`);
    } catch (e) { console.log(`${r}@${w} FAIL ${e.message.split('\n')[0]}`); }
  }
  await ctx.close();
}
await browser.close();
