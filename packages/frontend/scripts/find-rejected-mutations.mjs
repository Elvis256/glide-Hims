#!/usr/bin/env node
/**
 * Scanner 9: fields the frontend sends that the backend DTO will reject.
 *
 * The API runs ValidationPipe with whitelist + forbidNonWhitelisted, so a body
 * carrying ONE property the DTO does not declare is refused whole — the save
 * fails, nothing is written, and until the exception filter was fixed to pass
 * `details` through, the user saw only "Validation failed". A form that has
 * never once saved looks exactly like a form nobody tried.
 *
 * This is the mutation-side counterpart to scanner 8. Same lesson: the two
 * halves of the contract are written in different files by different hands,
 * and nothing checks that they agree.
 *
 * WHY THIS NEVER WRITES A ROW. Every probe body carries a sentinel key that no
 * DTO declares. forbidNonWhitelisted therefore rejects the request during
 * validation, before the handler is entered, so the probe cannot create,
 * update or delete anything. The response's `details` list then names every
 * unknown property it found — the sentinel, plus any real field the frontend
 * sends that the DTO does not accept, which is the finding. Any response that
 * is NOT a 4xx means validation did not run on that route, which is itself
 * reported: an unvalidated mutation endpoint is a bug on its own.
 *
 * DELETE is never probed.
 *
 * Usage: APP_PASS=... node scripts/find-rejected-mutations.mjs [--all]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API || 'http://localhost:3001/api/v1';
const TENANT = process.env.TENANT_ID || 'd268ddad-e283-4a67-a1e8-d3aac88d4f2f';
const SERVICES = new URL('../src/services/', import.meta.url).pathname;
const SHOW_ALL = process.argv.includes('--all');
const SENTINEL = '__contract_probe_do_not_accept__';

/* ---------- interfaces, for resolving `data: SomeDto` ---------------------- */

const interfaceFields = new Map();
for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(SERVICES, file), 'utf8');
  // The `\\{\\n` is load-bearing. With a bare `\\{` an empty single-line body
  // (`export interface UpdateEncounterDto extends Partial<X> {}`) has no
  // `\\n}` to close on, so the match ran on and captured the NEXT interface's
  // fields as its own — which is how a filter DTO's page/limit/dateFrom got
  // reported as an encounter update body the API rejects.
  const re = /export interface (\w+)\s*(?:extends [^{]+)?\{\n([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(src))) {
    const fields = [...m[2].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]);
    if (fields.length) interfaceFields.set(m[1], fields);
  }
}

/* ---------- extract (method, path, fields) -------------------------------- */

/** Top-level keys of a `{...}` literal, ignoring anything nested. */
function literalKeys(src, start) {
  let depth = 0;
  const keys = [];
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 60));
      if (m && (src[i - 1] === '{' || src[i - 1] === ',' || src[i - 1] === '\n')) {
        keys.push(m[1]);
        i += m[0].length - 1;
      }
    }
  }
  return [...new Set(keys)];
}

const probes = [];
for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(SERVICES, file), 'utf8');
  const re = /api\.(post|put|patch)(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]\s*,\s*/g;
  let m;
  while ((m = re.exec(src))) {
    const [method, path] = [m[1], m[2]];
    const after = m.index + m[0].length;
    let fields = null;
    if (src[after] === '{') {
      fields = literalKeys(src, after);
    } else {
      // A variable. Find the enclosing arrow function's typed parameter.
      const ident = /^([A-Za-z_$][\w$]*)/.exec(src.slice(after))?.[1];
      if (ident) {
        const before = src.slice(Math.max(0, m.index - 700), m.index);
        // The `\??` matters: without it an optional parameter (data?: Dto)
        // does not match and the search silently falls back to the PREVIOUS
        // method's parameter — which attributed TriageDto's eleven fields to
        // startTreatment and reported every one of them as rejected.
        const decl = [
          ...before.matchAll(new RegExp(`\\b${ident}\\s*\\??\\s*:\\s*(\\w+)`, 'g')),
        ].pop();
        if (decl && interfaceFields.has(decl[1])) fields = interfaceFields.get(decl[1]);
      }
    }
    if (fields?.length)
      probes.push({ file, method, path: path.replace(/^\/+/, ''), fields });
  }
}

/* ---------- login + path params ------------------------------------------- */

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

const idCache = new Map();
async function firstId(path) {
  if (idCache.has(path)) return idCache.get(path);
  let v = null;
  try {
    const r = await fetch(`${API}/${path}`, { headers: { cookie } });
    if (r.ok) {
      const b = await r.json();
      const rows = Array.isArray(b?.data) ? b.data : b?.data?.data;
      if (Array.isArray(rows) && rows[0]?.id) v = rows[0].id;
    }
  } catch {
    /* leave null */
  }
  idCache.set(path, v);
  return v;
}
const BY_PARAM_NAME = {
  patientId: 'patients',
  facilityId: 'facilities',
  invoiceId: 'billing/invoices',
  itemId: 'stores/items',
  admissionId: 'ipd/admissions?status=admitted',
  userId: 'users',
  wardId: 'ipd/wards',
};
async function fillParams(path) {
  const holes = [...path.matchAll(/\$\{(\w+)\}/g)];
  let out = path;
  for (const h of holes) {
    let v = BY_PARAM_NAME[h[1]] ? await firstId(BY_PARAM_NAME[h[1]]) : null;
    if (!v && /id$/i.test(h[1])) {
      const prefix = out.slice(0, out.indexOf(h[0])).replace(/^\/+/, '').replace(/\/+$/, '');
      if (prefix) v = await firstId(prefix);
    }
    if (!v) return null;
    out = out.replace(h[0], v);
  }
  return out;
}
const FAC = process.env.FACILITY_ID || (await firstId('facilities'));

/* ---------- probe ---------------------------------------------------------- */

const rejected = [];
const unvalidated = [];
const skipped = [];
const seen = new Set();

for (const p of probes) {
  const key = `${p.method} ${p.path} ${p.fields.join(',')}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const path = await fillParams(p.path);
  if (!path) {
    skipped.push(`${p.file} ${p.method.toUpperCase()} ${p.path} — unresolvable path`);
    continue;
  }

  // Junk values: only the property NAMES matter. The sentinel guarantees the
  // request is refused during validation, so the handler never runs.
  const body = { [SENTINEL]: 1 };
  for (const f of p.fields) body[f] = SENTINEL;

  let r;
  try {
    r = await fetch(`${API}/${path}`, {
      method: p.method.toUpperCase(),
      headers: { cookie, 'Content-Type': 'application/json', ...(FAC ? { 'x-facility-id': FAC } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    skipped.push(`${p.file} ${p.method.toUpperCase()} ${path} — request failed`);
    continue;
  }

  if (r.status < 400) {
    // Validation did not reject an unknown property. Either the route has no
    // DTO, or it does not go through the global pipe. Either way the sentinel
    // may have reached the handler.
    unvalidated.push(`${p.file} ${p.method.toUpperCase()} ${path} — HTTP ${r.status}`);
    continue;
  }
  if (r.status === 401 || r.status === 403 || r.status === 404) {
    skipped.push(`${p.file} ${p.method.toUpperCase()} ${path} — HTTP ${r.status}`);
    continue;
  }

  const b = await r.json().catch(() => null);
  const details = Array.isArray(b?.details) ? b.details : [];
  const unknown = details
    .filter((d) => (d.errors || []).some((e) => /should not exist/.test(e)))
    .map((d) => d.field);

  if (!details.length) {
    skipped.push(`${p.file} ${p.method.toUpperCase()} ${path} — HTTP ${r.status}, no details`);
    continue;
  }
  if (!unknown.includes(SENTINEL)) {
    // The sentinel was not reported, so this response is not a whitelist
    // verdict and absence of a field here proves nothing about it.
    skipped.push(`${p.file} ${p.method.toUpperCase()} ${path} — sentinel not echoed`);
    continue;
  }

  const bad = unknown.filter((f) => f !== SENTINEL && p.fields.includes(f));
  if (bad.length) rejected.push({ ...p, path, bad });
}

/* ---------- report --------------------------------------------------------- */

console.log(`\nprobed ${seen.size} mutation bodies (never writes: every body carries an unknown sentinel)\n`);

if (rejected.length) {
  console.log('THE API REFUSES THESE BODIES — the whole save fails, not just the field:');
  for (const r of rejected) {
    console.log(`  ${r.file} ${r.method.toUpperCase()} ${r.path}`);
    console.log(`      rejects: ${r.bad.join(', ')}`);
  }
} else {
  console.log('No frontend mutation body carries a field its DTO rejects.');
}

if (unvalidated.length) {
  console.log('\nAccepted an unknown property — no whitelist ran on these routes:');
  for (const u of unvalidated) console.log(`  ${u}`);
}

if (SHOW_ALL && skipped.length) {
  console.log('\nProved nothing:');
  for (const s of skipped) console.log(`  ${s}`);
} else if (skipped.length) {
  console.log(`\n${skipped.length} proved nothing — rerun with --all to list them.`);
}

console.log(`\n${rejected.length} bodies the API rejects, ${unvalidated.length} unvalidated routes`);
process.exit(rejected.length || unvalidated.length ? 1 : 0);
