/**
 * Standalone runner for EncryptPatientPii — bypasses pending unrelated
 * migrations that fail due to ownership issues on offline_licenses.
 * Usage: ts-node src/database/scripts/run-encrypt-patient-pii.ts
 */
import dataSource from '../../config/database.config';
import { EncryptPatientPii1777700000000 } from '../migrations/1777700000000-EncryptPatientPii';

async function main() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();
  await qr.connect();

  const existing = await qr.query(
    `SELECT 1 FROM migrations WHERE name = 'EncryptPatientPii1777700000000' LIMIT 1`,
  );
  if (existing.length > 0) {
    console.log('Migration already applied — nothing to do.');
    await qr.release();
    await dataSource.destroy();
    return;
  }

  await qr.startTransaction();
  try {
    const migration = new EncryptPatientPii1777700000000();
    await migration.up(qr);
    await qr.query(
      `INSERT INTO migrations (timestamp, name) VALUES (1777700000000, 'EncryptPatientPii1777700000000')`,
    );
    await qr.commitTransaction();
    console.log('✅ EncryptPatientPii migration applied successfully.');
  } catch (e) {
    await qr.rollbackTransaction();
    console.error('❌ Migration failed:', e);
    throw e;
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
