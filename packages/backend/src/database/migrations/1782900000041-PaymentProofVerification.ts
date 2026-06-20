import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentProofVerification1782900000041 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add verification columns to saas_payments
    await queryRunner.query(`ALTER TABLE "saas_payments" ADD COLUMN IF NOT EXISTS "verificationStatus" varchar(30) NOT NULL DEFAULT 'unverified'`);
    await queryRunner.query(`ALTER TABLE "saas_payments" ADD COLUMN IF NOT EXISTS "verifiedBy" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "saas_payments" ADD COLUMN IF NOT EXISTS "verifiedAt" timestamp NULL`);
    await queryRunner.query(`ALTER TABLE "saas_payments" ADD COLUMN IF NOT EXISTS "verificationNotes" text NULL`);

    // Auto-verify existing gateway payments (non-manual)
    await queryRunner.query(`UPDATE "saas_payments" SET "verificationStatus" = 'verified', "verifiedAt" = "paidAt" WHERE gateway != 'manual'`);

    // Create saas_payment_proofs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saas_payment_proofs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentId" uuid NOT NULL,
        "filePath" varchar(500) NOT NULL,
        "originalFilename" varchar(300) NOT NULL,
        "fileType" varchar(100) NOT NULL,
        "fileSize" integer NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "notes" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saas_payment_proofs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saas_payment_proofs_payment" FOREIGN KEY ("paymentId") REFERENCES "saas_payments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_saas_payment_proofs_paymentId" ON "saas_payment_proofs" ("paymentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saas_payment_proofs"`);
    await queryRunner.query(`ALTER TABLE "saas_payments" DROP COLUMN IF EXISTS "verificationNotes"`);
    await queryRunner.query(`ALTER TABLE "saas_payments" DROP COLUMN IF EXISTS "verifiedAt"`);
    await queryRunner.query(`ALTER TABLE "saas_payments" DROP COLUMN IF EXISTS "verifiedBy"`);
    await queryRunner.query(`ALTER TABLE "saas_payments" DROP COLUMN IF EXISTS "verificationStatus"`);
  }
}
