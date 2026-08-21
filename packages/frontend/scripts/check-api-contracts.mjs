/**
 * Compare frontend service interfaces against what the API actually returns.
 *
 * Three separate walks each turned up a service type declaring a field the
 * payload does not carry — administeredTime (the drug chart never showed when
 * a dose was given), dischargeType, findingCategory. A whole family of them
 * turned up in insurance and facilities: coverageLimit for annualLimit,
 * copayPercent for copayPercentage, isActive for status. None of these fail
 * loudly. TypeScript accepts a declared field the payload never sends, and the
 * value simply arrives undefined — so a coverage limit renders as 0, a
 * negative Remaining is shown to a cashier, or a department dropdown is
 * silently empty and an appointment cannot be booked.
 *
 * Usage:  APP_PASS=... node scripts/check-api-contracts.mjs
 *
 * Requires the dev stack up: it logs in and reads one real object per
 * endpoint, because live payloads are the only ground truth. Comparing
 * against backend entities instead over-reports badly — availableBeds,
 * staffCount and enrolledCount are computed by the API and perfectly real.
 *
 * Known limits:
 *   * Services with a normaliser are expected to differ. billing.ts
 *     deliberately maps discountAmount -> discount and balanceDue -> balance
 *     on every read path; that type is correct by design. Such services are
 *     listed in ADAPTED below and skipped.
 *   * An endpoint returning no rows proves nothing, and is reported as EMPTY
 *     rather than as a pass.
 *   * Optional fields that are genuinely absent from one sample row will show
 *     up here. Check a second row before believing a hit.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVICES = join(HERE, '..', 'src', 'services');
const API = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';
const TENANT = process.env.TENANT_ID || 'd268ddad-e283-4a67-a1e8-d3aac88d4f2f';

/** Services whose types describe a normalised shape, not the raw payload. */
const ADAPTED = new Set(['billing.ts']);

/** interface name -> endpoint that returns one of them. */
const ENDPOINTS = {
  Ward: 'ipd/wards',
  Admission: 'ipd/admissions?status=admitted',
  Facility: 'facilities',
  InsurancePolicy: 'insurance/policies?limit=1',
  PurchaseOrder: 'procurement/purchase-orders?facilityId=' + (process.env.FACILITY_ID || ''),
};

function interfaceFields(src, name) {
  const m = new RegExp(`export interface ${name}\\s*\\{`).exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1, body = '';
  while (i < src.length && depth) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) break; }
    body += ch; i++;
  }
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]);
}

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: process.env.APP_USER || 'reviewadmin',
    password: process.env.APP_PASS,
    tenantId: TENANT,
  }),
});
const cookie = (login.headers.getSetCookie?.() || []).join('; ');
if (!login.ok) { console.error('login failed:', login.status); process.exit(1); }

let problems = 0;
for (const file of readdirSync(SERVICES).filter((f) => f.endsWith('.ts'))) {
  if (ADAPTED.has(file)) continue;
  const src = readFileSync(join(SERVICES, file), 'utf8');
  for (const [name, path] of Object.entries(ENDPOINTS)) {
    const fields = interfaceFields(src, name);
    if (!fields) continue;
    const res = await fetch(`${API}/${path}`, { headers: { cookie } });
    if (!res.ok) { console.log(`  ${file} ${name}: endpoint ${res.status}`); continue; }
    const json = await res.json();
    const d = json.data ?? json;
    const rows = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [d]);
    const row = rows[0];
    if (!row || typeof row !== 'object') { console.log(`  ${file} ${name}: EMPTY — proves nothing`); continue; }
    const keys = new Set(Object.keys(row));
    const missing = fields.filter((f) => !keys.has(f));
    if (missing.length) {
      problems++;
      console.log(`  ${file} ${name} declares fields the payload lacks: ${missing.join(', ')}`);
    }
  }
}
console.log(problems ? `\n${problems} interfaces to check` : '\nNo unmatched fields on the sampled endpoints');
