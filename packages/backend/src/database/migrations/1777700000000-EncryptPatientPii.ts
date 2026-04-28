import { MigrationInterface, QueryRunner } from 'typeorm';
import { encryptPii, hashPii } from '../../common/crypto/pii-crypto';

/**
 * Encrypt patient PII at rest (national_id, phone, email) using AES-256-GCM and
 * add deterministic blind-index hash columns so equality lookups still work.
 *
 * - Widens columns to `text` to fit ciphertext.
 * - Drops indexes/uniqueness on the (now-ciphertext) plaintext columns.
 * - Adds `national_id_hash`, `phone_hash`, `email_hash` columns + indexes.
 * - Backfills existing rows: encrypts plaintext in place and populates hashes.
 *
 * Idempotent: rows whose national_id already begins with `v1:` are skipped.
 */
export class EncryptPatientPii1777700000000 implements MigrationInterface {
  name = 'EncryptPatientPii1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing indexes that referenced the soon-to-be-encrypted columns.
    //    Index names are TypeORM-generated; drop by name if present.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_national_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_phone"`);
    // Find and drop the unique national_id partial index whatever its generated name is.
    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'patients'
            AND indexdef ILIKE '%(national_id)%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
        END LOOP;
        FOR r IN
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'patients'
            AND indexdef ILIKE '%(phone)%'
            AND indexname NOT LIKE '%phone_hash%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
        END LOOP;
      END$$;
    `);

    // 2. Widen columns to text so AES-GCM ciphertext fits.
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "national_id" TYPE text USING "national_id"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "phone" TYPE text USING "phone"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "email" TYPE text USING "email"::text`,
    );

    // 3. Add blind-index hash columns.
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "national_id_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "phone_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "email_hash" varchar(64)`,
    );

    // 4. Backfill: encrypt existing plaintext and populate hashes.
    //    Done in Node so we can use the AES + HMAC helpers (cannot do in pure SQL).
    const rows: Array<{
      id: string;
      national_id: string | null;
      phone: string | null;
      email: string | null;
    }> = await queryRunner.query(
      `SELECT id, national_id, phone, email FROM patients WHERE deleted_at IS NULL`,
    );
    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];
      let i = 1;
      if (row.national_id && !row.national_id.startsWith('v1:')) {
        updates.push(`national_id = $${i++}`);
        params.push(encryptPii(row.national_id));
        updates.push(`national_id_hash = $${i++}`);
        params.push(hashPii(row.national_id, 'generic'));
      } else if (row.national_id && row.national_id.startsWith('v1:')) {
        // Already encrypted; nothing to do.
      }
      if (row.phone && !row.phone.startsWith('v1:')) {
        updates.push(`phone = $${i++}`);
        params.push(encryptPii(row.phone));
        updates.push(`phone_hash = $${i++}`);
        params.push(hashPii(row.phone, 'phone'));
      }
      if (row.email && !row.email.startsWith('v1:')) {
        updates.push(`email = $${i++}`);
        params.push(encryptPii(row.email));
        updates.push(`email_hash = $${i++}`);
        params.push(hashPii(row.email, 'email'));
      }
      if (updates.length === 0) continue;
      params.push(row.id);
      await queryRunner.query(
        `UPDATE patients SET ${updates.join(', ')} WHERE id = $${i}`,
        params,
      );
    }

    // 5. Recreate indexes against the hash columns.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patients_national_id_hash_unique"
         ON "patients" ("national_id_hash")
         WHERE national_id_hash IS NOT NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patients_phone_hash" ON "patients" ("phone_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patients_email_hash" ON "patients" ("email_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Decrypt back to plaintext so the schema downgrade is non-destructive when
    // the encryption key is still available.
    const { decryptPii } = await import('../../common/crypto/pii-crypto');
    const rows: Array<{
      id: string;
      national_id: string | null;
      phone: string | null;
      email: string | null;
    }> = await queryRunner.query(
      `SELECT id, national_id, phone, email FROM patients WHERE deleted_at IS NULL`,
    );
    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];
      let i = 1;
      if (row.national_id && row.national_id.startsWith('v1:')) {
        updates.push(`national_id = $${i++}`);
        params.push(decryptPii(row.national_id));
      }
      if (row.phone && row.phone.startsWith('v1:')) {
        updates.push(`phone = $${i++}`);
        params.push(decryptPii(row.phone));
      }
      if (row.email && row.email.startsWith('v1:')) {
        updates.push(`email = $${i++}`);
        params.push(decryptPii(row.email));
      }
      if (updates.length === 0) continue;
      params.push(row.id);
      await queryRunner.query(
        `UPDATE patients SET ${updates.join(', ')} WHERE id = $${i}`,
        params,
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_email_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_phone_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_national_id_hash_unique"`);

    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "email_hash"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "phone_hash"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "national_id_hash"`);

    // Restore original column types (best-effort; values that exceed length will fail).
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "national_id" TYPE varchar(50) USING substring("national_id" for 50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "phone" TYPE varchar(50) USING substring("phone" for 50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "email" TYPE varchar(100) USING substring("email" for 100)`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patients_national_id"
         ON "patients" ("national_id")
         WHERE national_id IS NOT NULL AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patients_phone" ON "patients" ("phone")`,
    );
  }
}
