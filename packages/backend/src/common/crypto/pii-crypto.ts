/**
 * PII column-level encryption + blind-index helpers.
 *
 * - Encryption: AES-256-GCM with a per-value random IV, output encoded as
 *   `v1:base64(iv|tag|ciphertext)`. The `v1:` prefix lets us rotate algorithms
 *   later without breaking existing rows.
 * - Decryption: tolerates legacy plaintext rows (returns the value as-is when
 *   the prefix is missing or decryption fails) so a partially-migrated table
 *   still serves data correctly.
 * - Blind index: HMAC-SHA256 of the normalized plaintext, hex-encoded. Lets us
 *   keep equality lookups (e.g. "find patient by national ID / phone") working
 *   on encrypted columns by indexing the hash instead.
 *
 * Configure with two env vars:
 *   PII_ENCRYPTION_KEY  — passphrase, scrypt-derived to a 32-byte AES key
 *   PII_HASH_KEY        — passphrase for the HMAC blind index
 *
 * If PII_ENCRYPTION_KEY is missing the helpers fall back to plaintext storage
 * (with a one-time warning) so dev/local databases keep working without setup.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from 'crypto';
import type { ValueTransformer } from 'typeorm';

const VERSION_PREFIX = 'v1:';
const SCRYPT_SALT = 'glide-hims-pii-v1';
const HASH_SALT = 'glide-hims-pii-hash-v1';

let aesKeyCache: Buffer | null | undefined; // undefined = not yet resolved
let hashKeyCache: Buffer | null | undefined;
let warnedMissingEnc = false;
let warnedMissingHash = false;

function getAesKey(): Buffer | null {
  if (aesKeyCache !== undefined) return aesKeyCache;
  const passphrase = process.env.PII_ENCRYPTION_KEY;
  if (!passphrase) {
    if (!warnedMissingEnc) {
      console.warn(
        '[pii-crypto] PII_ENCRYPTION_KEY is not set — patient PII columns will be stored as PLAINTEXT. Set it in .env to enable encryption.',
      );
      warnedMissingEnc = true;
    }
    aesKeyCache = null;
    return null;
  }
  aesKeyCache = scryptSync(passphrase, SCRYPT_SALT, 32);
  return aesKeyCache;
}

function getHashKey(): Buffer {
  if (hashKeyCache) return hashKeyCache;
  // Prefer a dedicated key, but fall back to deriving one from the AES passphrase
  // so deployments that only set PII_ENCRYPTION_KEY still get deterministic hashes.
  const passphrase =
    process.env.PII_HASH_KEY || process.env.PII_ENCRYPTION_KEY || '';
  if (!passphrase && !warnedMissingHash) {
    console.warn(
      '[pii-crypto] No PII_HASH_KEY / PII_ENCRYPTION_KEY set — blind-index hashes will use an empty key (DEV ONLY).',
    );
    warnedMissingHash = true;
  }
  hashKeyCache = scryptSync(passphrase, HASH_SALT, 32);
  return hashKeyCache;
}

/** Encrypt a string. Returns the original value if encryption isn't configured. */
export function encryptPii(plain: string): string {
  if (plain == null || plain === '') return plain;
  const key = getAesKey();
  if (!key) return plain;
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VERSION_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a value. Returns the input as-is if it isn't a recognized ciphertext. */
export function decryptPii(value: string): string {
  if (value == null || value === '') return value;
  if (!value.startsWith(VERSION_PREFIX)) return value; // legacy plaintext
  const key = getAesKey();
  if (!key) return value;
  try {
    const buf = Buffer.from(value.slice(VERSION_PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return value;
  }
}

/**
 * Normalize a value before hashing so equivalent inputs produce the same hash.
 * - lowercase + trim for general values (good for emails, national IDs)
 * - if the value looks like a phone number, keep digits only (so `+256 700 1234`
 *   matches `0700 1234` after stripping non-digits — caller decides intent
 *   via the `kind` parameter).
 */
export type PiiKind = 'generic' | 'phone' | 'email';

export function normalizePii(value: string, kind: PiiKind = 'generic'): string {
  if (value == null) return '';
  let s = String(value).trim();
  if (kind === 'phone') {
    s = s.replace(/\D+/g, '');
    // Drop leading country/zero so 0700123 ≡ +256700123 ≡ 256700123 collapse.
    // Keep last 9 digits (typical mobile MSISDN length in EA region).
    if (s.length > 9) s = s.slice(-9);
  } else {
    s = s.toLowerCase();
  }
  return s;
}

/** Deterministic blind-index hash, hex-encoded (64 chars). */
export function hashPii(plain: string, kind: PiiKind = 'generic'): string {
  if (plain == null || plain === '') return '';
  const key = getHashKey();
  return createHmac('sha256', key).update(normalizePii(plain, kind)).digest('hex');
}

/** TypeORM column transformer that encrypts on write and decrypts on read. */
export const piiColumnTransformer: ValueTransformer = {
  to: (value?: string | null) => (value == null ? value : encryptPii(value)),
  from: (value?: string | null) => (value == null ? value : decryptPii(value)),
};
