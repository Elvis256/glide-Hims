/**
 * Load a page of the running app and report what is actually rendered.
 *
 * Logs in through the real login form so the session cookie is set the way a
 * user's would be, then navigates and captures: a screenshot, any console
 * errors, and the focus order the keyboard actually produces.
 */
import { chromium } from 'playwright';

const BASE = process.env.APP_URL || 'http://127.0.0.1:5173';
const TENANT_SLUG = process.env.TENANT_SLUG || 'review-test';
const USER = process.env.APP_USER || 'reviewadmin';
const PASS = process.env.APP_PASS || '';
const [, , path = '/', outName = 'shot', widthArg = '1366', heightArg = '900'] = process.argv;
const OUT = process.env.SHOT_DIR || '/tmp';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: Number(widthArg), height: Number(heightArg) },
});

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 160)));

// The login form is gated on a resolved tenant, which comes from the slug in
// the path (or a subdomain). A bare /login leaves every control disabled.
await page.goto(`${BASE}/login/${TENANT_SLUG}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Log in with the review account if the form is present.
if (await page.locator('input[type="password"]').count()) {
  await page.fill('#username', USER);
  // Password from the environment: never commit a credential, even a dev one.
  await page.fill('#password', PASS);
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"], button:has-text("Sign")').first().click();
  await page.waitForTimeout(4000);
}

if (path !== '/login') {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

const file = `${OUT}/${outName}.png`;
await page.screenshot({ path: file, fullPage: false });

console.log('url:', page.url());
console.log('title:', await page.title());
console.log('screenshot:', file);
console.log('console errors:', consoleErrors.length ? consoleErrors.slice(0, 6) : 'none');

// What a keyboard user reaches first, in order.
const order = await page.evaluate(() => {
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  return Array.from(document.querySelectorAll(sel))
    .filter((el) => el.offsetParent !== null)
    .slice(0, 12)
    .map((el) => {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim();
      return `${el.tagName.toLowerCase()}: ${name.slice(0, 40) || '(no accessible name)'}`;
    });
});
console.log('first tab stops:');
order.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));

await browser.close();
