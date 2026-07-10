import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Quotation System: creates the price catalog, quotations, and
 * quotation revisions tables. Seeds the catalog with the 37 items previously
 * hardcoded in the frontend's SystemQuotationGeneratorPage DEFAULT_PRICES.
 * Also adds a quotation_id FK column on saas_subscriptions.
 */
export class SaasQuotationsAndPriceCatalog1782900000036 implements MigrationInterface {
  name = 'SaasQuotationsAndPriceCatalog1782900000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----- saas_price_catalog -----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saas_price_catalog (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code            VARCHAR(100) NOT NULL,
        name            VARCHAR(200) NOT NULL,
        description     TEXT,
        category        VARCHAR(30) NOT NULL DEFAULT 'module',
        "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
        currency        VARCHAR(3) NOT NULL DEFAULT 'UGX',
        "isActive"      BOOLEAN NOT NULL DEFAULT true,
        "sortOrder"     INTEGER NOT NULL DEFAULT 0,
        metadata        JSONB,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_price_catalog_code ON saas_price_catalog (code);`,
    );

    // ----- saas_quotations -----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saas_quotations (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "quotationNumber"       VARCHAR(30) NOT NULL,
        lead_id                 UUID,
        plan_id                 UUID,
        "clientName"            VARCHAR(200) NOT NULL,
        "clientOrganization"    VARCHAR(200),
        "clientEmail"           VARCHAR(200),
        "clientPhone"           VARCHAR(50),
        "clientCountry"         VARCHAR(100),
        currency                VARCHAR(3) NOT NULL DEFAULT 'UGX',
        fx_rate_to_base         NUMERIC(18,6) NOT NULL DEFAULT 1,
        "billingInterval"       VARCHAR(20) NOT NULL DEFAULT 'monthly',
        seats                   INTEGER NOT NULL DEFAULT 1,
        "includeVat"            BOOLEAN NOT NULL DEFAULT true,
        "vatRatePercent"        NUMERIC(5,2) NOT NULL DEFAULT 18,
        "deductWht"             BOOLEAN NOT NULL DEFAULT false,
        "whtRatePercent"        NUMERIC(5,2) NOT NULL DEFAULT 6,
        "discountPercent"       NUMERIC(5,2) NOT NULL DEFAULT 0,
        "discountFixedMinor"    INTEGER NOT NULL DEFAULT 0,
        "issueDate"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "validUntil"            TIMESTAMPTZ,
        "sentAt"                TIMESTAMPTZ,
        "acceptedAt"            TIMESTAMPTZ,
        "rejectedAt"            TIMESTAMPTZ,
        "currentRevisionNumber" INTEGER NOT NULL DEFAULT 1,
        status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
        subscription_id         UUID,
        contract_id             UUID,
        notes                   TEXT,
        "internalNotes"         TEXT,
        "createdBy"             UUID,
        metadata                JSONB,
        "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_number ON saas_quotations ("quotationNumber");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_quotation_lead ON saas_quotations (lead_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_quotation_status ON saas_quotations (status);`,
    );

    // ----- saas_quotation_revisions -----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saas_quotation_revisions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id    UUID NOT NULL REFERENCES saas_quotations(id) ON DELETE CASCADE,
        "revisionNumber" INTEGER NOT NULL,
        "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
        "discountMinor" INTEGER NOT NULL DEFAULT 0,
        "taxMinor"      INTEGER NOT NULL DEFAULT 0,
        "totalMinor"    INTEGER NOT NULL DEFAULT 0,
        "lineItems"     JSONB NOT NULL DEFAULT '[]',
        "changeNotes"   TEXT,
        "createdBy"     UUID,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (quotation_id, "revisionNumber")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_revision_quotation ON saas_quotation_revisions (quotation_id);`,
    );

    // ----- Add quotationId to saas_subscriptions -----
    await queryRunner.query(`
      ALTER TABLE saas_subscriptions ADD COLUMN IF NOT EXISTS "quotationId" UUID;
    `);

    // ----- Seed price catalog from the hardcoded DEFAULT_PRICES -----
    const items: Array<[string, string, number, string]> = [
      ['patients', 'Registration / Patients', 500000, 'module'],
      ['appointments', 'Appointments', 150000, 'module'],
      ['encounters', 'Encounters / Doctors', 200000, 'module'],
      ['vitals', 'Vitals / Nursing', 150000, 'module'],
      ['emergency', 'Emergency / Triage', 300000, 'module'],
      ['lab', 'Laboratory', 250000, 'module'],
      ['radiology', 'Radiology / Imaging', 350000, 'module'],
      ['pharmacy', 'Pharmacy / Dispensing', 250000, 'module'],
      ['controlled_substances', 'Controlled Substances', 120000, 'module'],
      ['drug_interactions', 'Drug Interactions', 100000, 'module'],
      ['inventory', 'Inventory / Stores', 180000, 'module'],
      ['suppliers', 'Suppliers', 120000, 'module'],
      ['wholesale', 'Wholesale / POS', 220000, 'module'],
      ['ipd', 'IPD / Wards', 320000, 'module'],
      ['theatre', 'Theatre / Surgery', 280000, 'module'],
      ['maternity', 'Maternity', 260000, 'module'],
      ['dental_charting', 'Dental Charting', 180000, 'module'],
      ['dental_procedures', 'Dental Procedures', 200000, 'module'],
      ['orthodontics', 'Orthodontics', 220000, 'module'],
      ['periodontics', 'Periodontics', 200000, 'module'],
      ['optical_exams', 'Optical Exams', 150000, 'module'],
      ['optical_rx', 'Optical Rx', 130000, 'module'],
      ['contact_lenses', 'Contact Lenses', 100000, 'module'],
      ['billing', 'Billing & Invoicing', 210000, 'module'],
      ['insurance', 'Insurance', 190000, 'module'],
      ['finance', 'Finance / Accounting', 220000, 'module'],
      ['reports', 'Reports & Analytics', 160000, 'module'],
      ['hr', 'Human Resources', 140000, 'module'],
      ['mobile_money', 'MTN/Airtel Mobile Money API', 500000, 'module'],
      ['ura_efris', 'URA EFRIS Compliance Connector', 1000000, 'module'],
      ['dhis2_connector', 'DHIS2 MoH Reporting Connector', 800000, 'module'],
      ['nira_validation', 'NIRA National ID Validator', 300000, 'module'],
      ['secugen_scanner', 'SecuGen Hamster Pro 20 Fingerprint Reader', 450000, 'hardware'],
      ['thermal_printer', '80mm Thermal Receipt Printer', 350000, 'hardware'],
      ['barcode_scanner', 'USB Handheld Barcode Scanner', 150000, 'hardware'],
      ['label_printer', 'Barcode Label Printer (Xprinter)', 450000, 'hardware'],
    ];

    for (let i = 0; i < items.length; i++) {
      const [code, name, price, cat] = items[i];
      await queryRunner.query(
        `INSERT INTO saas_price_catalog (code, name, "unitPriceMinor", category, "sortOrder")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING`,
        [code, name, price, cat, i + 1],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE saas_subscriptions DROP COLUMN IF EXISTS "quotationId";`);
    await queryRunner.query(`DROP TABLE IF EXISTS saas_quotation_revisions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS saas_quotations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS saas_price_catalog;`);
  }
}
