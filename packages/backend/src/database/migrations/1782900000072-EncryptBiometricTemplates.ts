import { MigrationInterface, QueryRunner } from 'typeorm';
import { encryptPii, decryptPii } from '../../common/crypto/pii-crypto';

/**
 * Encrypt existing plaintext fingerprint templates at rest (AES-256-GCM via
 * pii-crypto). Going forward the entity transformer encrypts on write.
 * Ciphertext rows are identifiable by the 'v1:' prefix, so the migration is
 * idempotent. If PII encryption is not configured (no key), encryptPii
 * returns the input unchanged and this is a no-op.
 */
export class EncryptBiometricTemplates1782900000072 implements MigrationInterface {
  name = 'EncryptBiometricTemplates1782900000072';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; template_data: string }> = await queryRunner.query(
      `SELECT id, template_data FROM biometric_data
        WHERE template_data IS NOT NULL AND template_data NOT LIKE 'v1:%'`,
    );
    for (const row of rows) {
      const encrypted = encryptPii(row.template_data);
      if (encrypted !== row.template_data) {
        await queryRunner.query(`UPDATE biometric_data SET template_data = $1 WHERE id = $2`, [
          encrypted,
          row.id,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: string; template_data: string }> = await queryRunner.query(
      `SELECT id, template_data FROM biometric_data WHERE template_data LIKE 'v1:%'`,
    );
    for (const row of rows) {
      await queryRunner.query(`UPDATE biometric_data SET template_data = $1 WHERE id = $2`, [
        decryptPii(row.template_data),
        row.id,
      ]);
    }
  }
}
