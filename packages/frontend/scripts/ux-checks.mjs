/**
 * Two things unit tests cannot answer: does a dialog behave like a dialog in a
 * real browser, and does a screen fit the ones a ward actually uses.
 *
 * Dialogs: opens a modal, checks it announces as one, that focus moved inside
 * it, and that Escape closes it. The unit tests cover the hook; this covers the
 * hook actually being wired to the markup.
 *
 * Widths: 1366 laptop, 1024 ward terminal, 768 tablet. Reports any element
 * spilling past the viewport, which is what breaks a screen someone has to use
 * standing up.
 *
 *   APP_PASS=... node scripts/ux-checks.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.APP_URL || 'http://127.0.0.1:5173';
const SLUG = process.env.TENANT_SLUG || 'review-test';
const USER = process.env.APP_USER || 'reviewadmin';
const PASS = process.env.APP_PASS || '';

const DIALOGS = [
  ['/billing/invoices', 'View'],
  ['/billing/invoices', 'Collect Payment'],
];
const ROUTES = ['/dashboard', '/emergency', '/patients', '/ipd/admissions', '/billing/invoices', '/nursing/vitals/new', '/lab/queue'];
const SIZES = [[1366, 768, 'laptop'], [1024, 768, 'ward terminal'], [768, 1024, 'tablet']];

const browser = await chromium.launch({ headless: true });

async function signIn(page) {
  await page.goto(`${BASE}/login/${SLUG}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3800);
}

console.log('=== dialogs ===');
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await signIn(page);
  for (const [route, label] of DIALOGS) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1400);
    const sel = `button[title="${label}"], button[aria-label="${label}"], button:has-text("${label}")`;
    try {
      const inRow = page.locator('tbody tr').first().locator(sel).first();
      if (await inRow.count()) await inRow.click({ timeout: 3000 });
      else await page.locator(sel).first().click({ timeout: 3000 });
    } catch { /* button absent on this data */ }
    await page.waitForTimeout(1200);

    const opened = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (!opened) { console.log(`  skip  ${route} [${label}] — nothing opened`); continue; }
    const focusInside = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return !!(d && d.contains(document.activeElement));
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const closed = !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')));
    const ok = focusInside && closed;
    console.log(`  ${ok ? 'ok  ' : 'FLAG'}  ${route} [${label}] focusInside=${focusInside} closedOnEscape=${closed}`);
  }
  await page.close();
}

console.log('\n=== widths ===');
for (const [w, h, name] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await signIn(page);
  const bad = [];
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      let worst = null, worstW = 0;
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > de.clientWidth + 2 && rect.width > worstW) {
          worstW = rect.width;
          worst = (el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.')).slice(0, 50);
        }
      }
      return { overflow: de.scrollWidth - de.clientWidth, worst, worstW: Math.round(worstW) };
    }).catch(() => ({ overflow: 0 }));
    if (m.overflow > 2) bad.push(`    ${String(m.overflow).padStart(4)}px overflow  ${r}  widest: ${m.worst} (${m.worstW}px)`);
  }
  console.log(`  ${name} ${w}x${h}: ${bad.length ? bad.length + ' screens overflow' : 'all clear'}`);
  bad.forEach((l) => console.log(l));
  await page.close();
}

await browser.close();
