/**
 * Walk the screens the navigation never links to: detail pages, wizards and
 * anything reached by clicking a row.
 *
 * For each list page it opens the first row, records where that landed, and
 * reports console errors, uncaught exceptions and failed requests for the
 * destination. The top-level sweep cannot reach any of this.
 *
 *   APP_PASS=... node scripts/deep-sweep.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.APP_URL || 'http://127.0.0.1:5173';
const SLUG = process.env.TENANT_SLUG || 'review-test';

// List screens whose rows lead somewhere.
const LISTS = [
  '/patients',
  '/encounters',
  '/ipd/admissions',
  '/billing/invoices',
  '/lab/queue',
  '/pharmacy/queue',
  '/emergency/queue',
  '/radiology/queue',
  '/appointments',
  '/follow-ups',
  '/chronic-care/registry',
  '/doctor/queue',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.goto(`${BASE}/login/${SLUG}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
await page.fill('#username', process.env.APP_USER || 'reviewadmin');
await page.fill('#password', process.env.APP_PASS || '');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

const report = [];

for (const list of LISTS) {
  const errors = [];
  const failed = [];
  const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 130)); };
  const onPageError = (e) => errors.push('EXCEPTION: ' + String(e).split('\n')[0].slice(0, 130));
  const onResponse = (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${(r.url().split('/api/v1')[1] || r.url()).slice(0, 60)}`); };

  await page.goto(BASE + list, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);

  const before = page.url();
  // Click the first thing in the list body that looks like a row.
  const clicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"], [data-patient-item], li[class*="cursor-pointer"], div[class*="cursor-pointer"]'))
      .filter((el) => el.offsetParent !== null && (el.textContent || '').trim().length > 12);
    if (!rows.length) return false;
    rows[0].click();
    return true;
  }).catch(() => false);

  await page.waitForTimeout(2500);
  const after = page.url();

  const probe = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return {
      boundary: /something went wrong|unexpected error/i.test(t),
      invalidDate: /invalid date/i.test(t),
      undef: /\bundefined\b/.test(t),
      nan: /\bNaN\b/.test(t),
      chars: t.trim().length,
    };
  }).catch(() => ({ chars: 0 }));

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);

  const flags = [];
  if (!clicked) flags.push('no rows');
  else if (after === before) flags.push('row click went nowhere');
  if (probe.boundary) flags.push('ERROR BOUNDARY');
  if (probe.invalidDate) flags.push('shows "Invalid Date"');
  if (probe.undef) flags.push('shows "undefined"');
  if (probe.nan) flags.push('shows "NaN"');

  report.push({ list, dest: after.replace(BASE, ''), flags, errors: [...new Set(errors)], failed: [...new Set(failed)] });
}

for (const r of report) {
  const bad = r.flags.length || r.errors.length || r.failed.length;
  if (!bad) { console.log(`ok    ${r.list} -> ${r.dest}`); continue; }
  console.log(`\nFLAG  ${r.list} -> ${r.dest}`);
  r.flags.forEach((f) => console.log(`        ${f}`));
  r.errors.slice(0, 3).forEach((e) => console.log(`        ERR  ${e}`));
  r.failed.slice(0, 3).forEach((f) => console.log(`        HTTP ${f}`));
}

await browser.close();
