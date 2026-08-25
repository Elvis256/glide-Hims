#!/usr/bin/env node
/**
 * Scanner 8: fields a service interface promises that the endpoint never sends.
 *
 * Two bugs of this exact shape were fixed by hand before this existed:
 *
 *   * radiology getOrders joined patient/modality/orderedBy but not
 *     performedBy, so the analytics page bucketed every study under
 *     "Unassigned" — the per-radiologist breakdown could not be non-empty.
 *   * ipd getMedicationSchedule never joined administeredBy, so all three
 *     screens showing who gave a dose rendered a blank where the nurse's
 *     name belongs.
 *
 * Both were invisible to tsc (the field is declared, so the read type-checks),
 * invisible to the test suite (the services are mocked), and invisible to the
 * old contract checker, which only knew 21 hand-written endpoints. The
 * frontend already names both halves — `api.get<Bed[]>('/ipd/beds')` states
 * the interface AND the URL — so the probe list is derived from the service
 * code instead of maintained by hand.
 *
 * PRECISION IS THE WHOLE PROBLEM. A field the payload lacks is only a bug if
 * something reads it. Three times during this campaign a "missing field" was
 * a false positive: the consuming page normalised the payload itself, or the
 * field was a documented legacy alias sitting behind a `||` fallback, or the
 * value came from a different endpoint (Bed.currentPatient is served by
 * /ipd/bed-board, PurchaseRequest.approvedBy by /procurement/trace). So every
 * finding is classified by whether a page actually dereferences it, and only
 * the READ ones are claimed as defects. The rest are printed as context and
 * cost nothing to ignore.
 *
 * KNOWN IMPRECISION, so nobody trusts this further than it deserves:
 *   * isRead() matches a field name anywhere under src/pages, not on this
 *     interface specifically. `DailyRevenue.totalRevenue` reports as read
 *     because two pages read `.totalRevenue` — from /analytics, not from the
 *     endpoint probed here. Confirm the consumer before believing a finding.
 *   * A required field can still be absent because the whole feature has no
 *     rows yet, not because the query is wrong.
 *   * Only literal-path api.get<T>() calls are probed; anything built from a
 *     template string is invisible to it. 141 of 291 typed GETs today.
 * It exists to shorten the search, not to end it.
 *
 * Usage: APP_PASS=... node scripts/find-unjoined-relations.mjs [--all]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API || 'http://localhost:3001/api/v1';
const TENANT = process.env.TENANT_ID || 'd268ddad-e283-4a67-a1e8-d3aac88d4f2f';
const SERVICES = new URL('../src/services/', import.meta.url).pathname;
const PAGES = new URL('../src/pages/', import.meta.url).pathname;
const SHOW_ALL = process.argv.includes('--all');

/* ---------- 1. every page source, concatenated once for read-detection ---- */

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
const pageFiles = walk(PAGES);
const pageSource = pageFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

/** Does any page dereference `.field`, as `x.field.y`, `x.field?.y` or `x.field)`? */
function isRead(field) {
  const re = new RegExp(`\\.${field}\\s*(\\?\\.|\\.|\\)|\\]|,|\\s*\\|\\||\\s*&&|\\s*\\?)`, 'm');
  return re.test(pageSource);
}

/* ---------- 2. interface field lists -------------------------------------- */

const interfaces = new Map(); // "file.ts:Name" -> [field,...]
for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(SERVICES, file), 'utf8');
  const re = /export interface (\w+)\s*(?:extends [^{]+)?\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(src))) {
    // Only top-level members: two-space indent, not nested object literals.
    // Optionality is the signal that separates a contract violation from a
    // relation that simply has no data today: a required field the endpoint
    // omits is always a defect, an optional one may just be an empty column.
    const fields = [...m[2].matchAll(/^ {2}(\w+)(\??):/gm)].map((x) => ({
      name: x[1],
      required: x[2] !== '?',
    }));
    if (fields.length) interfaces.set(`${file}:${m[1]}`, fields);
  }
}

/* ---------- 3. derive probes from api.get<T>('literal') ------------------- */

const probes = []; // {file, iface, path}
for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(SERVICES, file), 'utf8');
  const re = /api\.get<([^>]+)>\(\s*['"`]([^'"`$]+)['"`]/g;
  let m;
  while ((m = re.exec(src))) {
    let type = m[1].trim();
    // Unwrap the two envelope shapes the services use.
    const env = type.match(/^\{\s*data:\s*([A-Za-z0-9_]+)(\[\])?\s*\}$/);
    if (env) type = env[1];
    type = type.replace(/\[\]$/, '').trim();
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(type)) continue; // any, inline shapes, primitives
    const key = `${file}:${type}`;
    if (!interfaces.has(key)) continue; // imported from elsewhere; not ours to check
    probes.push({ file, iface: type, key, path: m[2].replace(/^\//, '') });
  }
}

/* ---------- 4. probe live ------------------------------------------------- */

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: process.env.APP_USER || 'reviewadmin',
    password: process.env.APP_PASS,
    tenantId: TENANT,
  }),
});
if (!login.ok) {
  console.error('login failed:', login.status);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() || []).join('; ');

async function firstId(path) {
  const r = await fetch(`${API}/${path}`, { headers: { cookie } });
  if (!r.ok) return null;
  const b = await r.json().catch(() => null);
  const rows = Array.isArray(b?.data) ? b.data : b?.data?.data;
  return Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
}
const FAC = process.env.FACILITY_ID || (await firstId('facilities'));

/**
 * Send the facility as a header first. Appending ?facilityId= is not a safe
 * default: these query DTOs run under forbidNonWhitelisted, so a parameter the
 * DTO does not declare turns a good request into a 400 that looks exactly like
 * a validation bug in the endpoint.
 */
async function probe(path) {
  const headers = { cookie, ...(FAC ? { 'x-facility-id': FAC } : {}) };
  let r = await fetch(`${API}/${path}`, { headers });
  if (r.status === 400 && FAC && !path.includes('facilityId')) {
    const sep = path.includes('?') ? '&' : '?';
    r = await fetch(`${API}/${path}${sep}facilityId=${FAC}`, { headers });
  }
  if (!r.ok) return { status: r.status, rows: [] };
  const b = await r.json().catch(() => null);
  return { status: r.status, rows: unwrap(b) };
}

/**
 * Peel the response envelope down to the rows the interface describes.
 *
 * Order matters and the plain-object case must come before any fallback to
 * the envelope itself. Falling through to `b` treats {statusCode, data} as the
 * row, so every field of a singleton payload — a dashboard, a stats block —
 * reports as missing and the scanner indicts a dozen healthy endpoints. That
 * is not a hypothetical: it is what the first run of this scanner did.
 */
function unwrap(b) {
  if (b == null || typeof b !== 'object') return [];
  if (Array.isArray(b)) return b;
  for (const inner of [b.data, b.data?.data, b.data?.items, b.items]) {
    if (Array.isArray(inner)) return inner;
  }
  const d = b.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    // A singleton payload. Only descend again if this level is itself another
    // envelope, never past the object that actually carries the fields.
    if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) return [d.data];
    return [d];
  }
  // No `data` key at all: the endpoint returns the object bare.
  if (!('data' in b)) return [b];
  return [];
}

/* ---------- 5. compare ---------------------------------------------------- */

const seen = new Set();
const defects = [];
const possible = [];
const context = [];
const unproven = [];

for (const p of probes) {
  if (seen.has(p.key + p.path)) continue;
  seen.add(p.key + p.path);

  const { status, rows } = await probe(p.path);
  if (status !== 200) {
    unproven.push(`${p.file} ${p.iface}: HTTP ${status} — ${p.path}`);
    continue;
  }
  if (!rows.length) {
    unproven.push(`${p.file} ${p.iface}: no rows — ${p.path}`);
    continue;
  }
  // Union the keys: a nullable relation is absent on some rows and present on
  // others, and faulting on row 0 alone reports a field the endpoint does send.
  const present = new Set();
  for (const row of rows.slice(0, 25)) {
    if (row && typeof row === 'object') for (const k of Object.keys(row)) present.add(k);
  }
  const missing = interfaces.get(p.key).filter((f) => !present.has(f.name));
  if (!missing.length) continue;

  const read = missing.filter((f) => isRead(f.name));
  const unread = missing.filter((f) => !read.includes(f));
  const broken = read.filter((f) => f.required);
  const maybe = read.filter((f) => !f.required);

  if (broken.length) defects.push({ ...p, fields: broken.map((f) => f.name) });
  if (maybe.length) possible.push({ ...p, fields: maybe.map((f) => f.name) });
  if (unread.length) context.push({ ...p, fields: unread.map((f) => f.name) });
}

/* ---------- 6. report ----------------------------------------------------- */

console.log(`\nprobed ${seen.size} endpoints derived from ${probes.length} typed api.get calls\n`);

if (defects.length) {
  console.log('READ BY A PAGE — the page renders nothing where these belong:');
  for (const d of defects) {
    console.log(`  ${d.file} ${d.iface}: ${d.fields.join(', ')}`);
    console.log(`      ${d.path}`);
  }
} else {
  console.log('No required field read by a page is missing from its payload.');
}

if (possible.length) {
  console.log(
    '\nOptional, read by a page, absent everywhere in this dataset.',
  );
  console.log(
    'Each is EITHER an unjoined relation OR a column with no rows yet — check the\n' +
      'data before touching the query. doctor_duties being empty made all five\n' +
      'DoctorWithDutyStatus fields look missing when the endpoint returns them fine.',
  );
  for (const q of possible) {
    console.log(`  ${q.file} ${q.iface}: ${q.fields.join(', ')}`);
    console.log(`      ${q.path}`);
  }
}

if (SHOW_ALL) {
  if (context.length) {
    console.log('\nDeclared but unread (not claimed as defects):');
    for (const c of context) console.log(`  ${c.file} ${c.iface}: ${c.fields.join(', ')}`);
  }
  if (unproven.length) {
    console.log('\nProved nothing (no rows, or the probe needs args this cannot supply):');
    for (const u of unproven) console.log(`  ${u}`);
  }
} else {
  console.log(
    `\n${context.length} declared-but-unread, ${unproven.length} unproven — rerun with --all to list them.`,
  );
}

console.log(
  `\n${defects.length} contract violations (required + read), ${possible.length} to check by hand`,
);
process.exit(defects.length ? 1 : 0);
