#!/usr/bin/env node
/**
 * One-off data fix: normalize double-encrypted PII values.
 *
 * Bug class: a code path read the RAW column value (bypassing the TypeORM
 * transformer) and re-saved it through the entity — encrypting the already
 * `v1:` ciphertext. Reads then decrypt only one layer and the UI shows
 * `v1:...` garbage; the blind-index hash was also computed from ciphertext,
 * silently breaking phone/NIN/email search for those rows.
 *
 * This script peels nested encryption layers down to the plaintext,
 * re-encrypts exactly once, and recomputes the blind-index hashes.
 *
 * Usage (from packages/backend):
 *   node scripts/fix-double-encrypted-pii.js                        # dry-run (default)
 *   node scripts/fix-double-encrypted-pii.js --apply                # write fixes
 *   node scripts/fix-double-encrypted-pii.js --apply --null-unrecoverable
 *       Additionally NULLs values (and their blind-index hashes) that cannot
 *       be decrypted with the current key (e.g. rows written under a key that
 *       was later regenerated). Use only after confirming no old key exists.
 *
 * Prints row ids and layer counts only — NEVER plaintext.
 */
const fs = require('fs');
const path = require('path');
const { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } = require('crypto');
const { Client } = require('pg');

// ── env (parse .env manually — no dotenv direct dep under pnpm strict mode) ──
const envPath = path.resolve(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ── crypto: mirrors src/common/crypto/pii-crypto.ts exactly ──────────────────
const VERSION_PREFIX = 'v1:';
const SCRYPT_SALT = 'glide-hims-pii-v1';
const HASH_SALT = 'glide-hims-pii-hash-v1';

const passphrase = process.env.PII_ENCRYPTION_KEY;
if (!passphrase) {
  console.error('PII_ENCRYPTION_KEY not set in .env — aborting.');
  process.exit(1);
}
// Current key first, then retired keys (PII_ENCRYPTION_KEY_PREVIOUS, comma-separated)
const previousPassphrases = (process.env.PII_ENCRYPTION_KEY_PREVIOUS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const aesKeys = [passphrase, ...previousPassphrases].map((p) => scryptSync(p, SCRYPT_SALT, 32));
const aesKey = aesKeys[0];
const hashKey = scryptSync(process.env.PII_HASH_KEY || passphrase, HASH_SALT, 32);
console.log(`Keys loaded: 1 current + ${previousPassphrases.length} previous`);

/** Try every key. Returns { plain, keyIdx } or null when no key opens it. */
function decryptOnce(value) {
  const buf = Buffer.from(value.slice(VERSION_PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  for (let i = 0; i < aesKeys.length; i++) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', aesKeys[i], iv);
      decipher.setAuthTag(tag);
      return {
        plain: Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'),
        keyIdx: i,
      };
    } catch {
      // wrong key — try next
    }
  }
  return null;
}

function encryptOnce(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VERSION_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

function normalize(value, kind) {
  let s = String(value).trim();
  if (kind === 'phone') {
    s = s.replace(/\D+/g, '');
    if (s.length > 9) s = s.slice(-9);
  } else {
    s = s.toLowerCase();
  }
  return s;
}

function hashPii(plain, kind) {
  return createHmac('sha256', hashKey).update(normalize(plain, kind)).digest('hex');
}

/**
 * Peel encryption layers. Returns { plain, layers } or { error }.
 *  layers === 1 → healthy (encrypted exactly once)
 *  layers >= 2 → was double/multi encrypted
 */
function peel(value) {
  let v = value;
  let layers = 0;
  let usedOldKey = false;
  for (let i = 0; i < 6; i++) {
    if (!v.startsWith(VERSION_PREFIX)) return { plain: v, layers, usedOldKey };
    const d = decryptOnce(v);
    if (d === null) return { error: 'undecryptable', layers };
    if (d.keyIdx > 0) usedOldKey = true;
    v = d.plain;
    layers++;
  }
  return { error: 'too-deep', layers };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const nullUnrecoverable = process.argv.includes('--null-unrecoverable');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    // Owner role bypasses RLS so every tenant's rows are scanned
    user: process.env.DB_MIGRATION_USERNAME || process.env.DB_USERNAME,
    password: process.env.DB_MIGRATION_PASSWORD || process.env.DB_PASSWORD,
  });
  await client.connect();
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'} (user=${process.env.DB_MIGRATION_USERNAME || process.env.DB_USERNAME})`);

  const stats = { healthy: 0, fixed: 0, undecryptable: 0, nulled: 0 };

  // ── patients: national_id / phone / email + their blind-index hashes ──────
  const cols = [
    { col: 'national_id', hashCol: 'national_id_hash', kind: 'generic' },
    { col: 'phone', hashCol: 'phone_hash', kind: 'phone' },
    { col: 'email', hashCol: 'email_hash', kind: 'email' },
  ];
  const { rows: patients } = await client.query(
    `SELECT id, national_id, phone, email FROM patients
     WHERE national_id LIKE 'v1:%' OR phone LIKE 'v1:%' OR email LIKE 'v1:%'`,
  );
  console.log(`patients with encrypted PII: ${patients.length}`);

  for (const row of patients) {
    const sets = [];
    const vals = [];
    for (const { col, hashCol, kind } of cols) {
      const raw = row[col.replace(/_([a-z])/g, (_, c) => c)] ?? row[col]; // pg returns snake_case keys
      const value = row[col] ?? raw;
      if (!value || !String(value).startsWith(VERSION_PREFIX)) continue;
      const res = peel(String(value));
      if (res.error) {
        stats.undecryptable++;
        if (nullUnrecoverable) {
          console.log(`  NULL patients.${col} id=${row.id} (${res.error} — value unrecoverable)`);
          sets.push(`${col} = NULL`);
          sets.push(`${hashCol} = NULL`);
          stats.nulled++;
        } else {
          console.log(`  UNDECRYPTABLE patients.${col} id=${row.id} (${res.error}, layers=${res.layers})`);
        }
        continue;
      }
      if (res.layers <= 1 && !res.usedOldKey) {
        stats.healthy++;
        continue;
      }
      stats.fixed++;
      console.log(`  FIX patients.${col} id=${row.id} layers=${res.layers}${res.usedOldKey ? ' (old key)' : ''}`);
      sets.push(`${col} = $${vals.length + 1}`);
      vals.push(encryptOnce(res.plain));
      sets.push(`${hashCol} = $${vals.length + 1}`);
      vals.push(hashPii(res.plain, kind));
    }
    if (sets.length && apply) {
      vals.push(row.id);
      await client.query(`UPDATE patients SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    }
  }

  // ── biometric_data.template_data (no hash column) ─────────────────────────
  const { rows: bios } = await client.query(
    `SELECT id, template_data FROM biometric_data WHERE template_data LIKE 'v1:%'`,
  );
  console.log(`biometric_data rows with encrypted template: ${bios.length}`);
  for (const row of bios) {
    const res = peel(String(row.template_data));
    if (res.error) {
      stats.undecryptable++;
      console.log(`  UNDECRYPTABLE biometric_data.template_data id=${row.id} (${res.error})`);
      continue;
    }
    if (res.layers <= 1 && !res.usedOldKey) {
      stats.healthy++;
      continue;
    }
    stats.fixed++;
    console.log(`  FIX biometric_data.template_data id=${row.id} layers=${res.layers}${res.usedOldKey ? ' (old key)' : ''}`);
    if (apply) {
      await client.query(`UPDATE biometric_data SET template_data = $1 WHERE id = $2`, [
        encryptOnce(res.plain),
        row.id,
      ]);
    }
  }

  console.log(`\nSummary: healthy=${stats.healthy} fixed=${stats.fixed} undecryptable=${stats.undecryptable} nulled=${stats.nulled}${apply ? '' : ' (dry-run — nothing written)'}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
