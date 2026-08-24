/**
 * Walk every screen reachable from the navigation and report what breaks.
 *
 * For each page: console errors, uncaught exceptions, failed network calls,
 * whether anything actually rendered, and whether an error boundary caught it.
 * Compact by design — the point is to find the screens worth looking at, not
 * to look at all of them.
 *
 *   APP_PASS=... node scripts/sweep.mjs [limit]
 */
import { chromium } from 'playwright';

const BASE = process.env.APP_URL || 'http://127.0.0.1:5173';
const TENANT_SLUG = process.env.TENANT_SLUG || 'review-test';
const USER = process.env.APP_USER || 'reviewadmin';
const PASS = process.env.APP_PASS || '';
const LIMIT = Number(process.argv[2] || 200);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.goto(`${BASE}/login/${TENANT_SLUG}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
await page.fill('#username', USER);
await page.fill('#password', PASS);
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

// The nav is dropdown buttons and each menu closes when the next opens, so
// harvest links after opening each one rather than all at the end.
const collected = new Set();
const grab = async () => {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('/') && !h.startsWith('//')),
  );
  hrefs.forEach((h) => collected.add(h));
};

await grab();
const menuCount = await page.locator('nav button, header button').count();
for (let i = 0; i < menuCount; i++) {
  try {
    await page.locator('nav button, header button').nth(i).click({ timeout: 1200 });
    await page.waitForTimeout(150);
    await grab();
  } catch { /* not a menu */ }
}
const links = [...collected];

const routes = [...new Set(links)].slice(0, LIMIT);
console.log(`discovered ${routes.length} routes from the navigation\n`);

const rows = [];
for (const route of routes) {
  const errors = [];
  const failed = [];
  const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); };
  const onPageError = (e) => errors.push('EXCEPTION: ' + String(e).split('\n')[0].slice(0, 120));
  const onResponse = (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().split('/api/v1')[1] || r.url().slice(-40)}`); };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  let state = 'ok';
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(900);
  } catch {
    state = 'timeout';
  }

  const probe = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return {
      chars: t.trim().length,
      boundary: /something went wrong|unexpected error|try again/i.test(t),
      denied: /access denied|not authorised|not authorized|no permission/i.test(t),
      empty: t.trim().length < 120,
    };
  }).catch(() => ({ chars: 0, boundary: false, denied: false, empty: true }));

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  if (probe.boundary) state = 'ERROR BOUNDARY';
  else if (probe.denied) state = 'access denied';
  else if (probe.empty) state = 'BLANK';

  rows.push({ route, state, errors: errors.length, failed: [...new Set(failed)].slice(0, 2), chars: probe.chars });
}

const bad = rows.filter((r) => r.state !== 'ok' || r.errors > 0 || r.failed.length > 0);
console.log(`=== ${bad.length} of ${rows.length} screens need a look ===`);
for (const r of bad) {
  console.log(`${r.state.padEnd(15)} ${r.route.padEnd(34)} errors=${r.errors} ${r.failed.join(' | ')}`);
}
console.log(`\n=== clean: ${rows.length - bad.length} ===`);
console.log(rows.filter((r) => !bad.includes(r)).map((r) => r.route).join(', '));

await browser.close();
