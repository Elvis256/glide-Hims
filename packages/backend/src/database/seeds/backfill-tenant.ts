/**
 * Backfill tenantId on users and patients from their facility's tenant.
 * Run once after deploying the multi-tenancy schema changes.
 * 
 * Usage: npx ts-node src/database/seeds/backfill-tenant.ts
 */
import { DataSource } from 'typeorm';

async function backfill() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'glide_hims',
    password: process.env.DB_PASSWORD || 'glide_hims_dev_password',
    database: process.env.DB_NAME || 'glide_hims_dev',
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('🔄 Starting tenant backfill...\n');

  // 1. Backfill users.tenant_id from facilities
  const userResult = await dataSource.query(`
    UPDATE users u
    SET tenant_id = f.tenant_id
    FROM facilities f
    WHERE u.facility_id = f.id
      AND u.tenant_id IS NULL
      AND f.tenant_id IS NOT NULL
  `);
  console.log(`✓ Updated ${userResult[1]} users with tenant_id from their facility`);

  // 2. Backfill patients.tenant_id from their encounters → facilities
  const patientResult = await dataSource.query(`
    UPDATE patients p
    SET tenant_id = sub.tenant_id
    FROM (
      SELECT DISTINCT ON (e.patient_id) e.patient_id, f.tenant_id
      FROM encounters e
      JOIN facilities f ON e.facility_id = f.id
      WHERE f.tenant_id IS NOT NULL
      ORDER BY e.patient_id, e.created_at DESC
    ) sub
    WHERE p.id = sub.patient_id
      AND p.tenant_id IS NULL
  `);
  console.log(`✓ Updated ${patientResult[1]} patients with tenant_id from their encounters`);

  // 3. Report any remaining nulls
  const usersWithoutTenant = await dataSource.query(
    `SELECT COUNT(*) as count FROM users WHERE tenant_id IS NULL AND deleted_at IS NULL`
  );
  const patientsWithoutTenant = await dataSource.query(
    `SELECT COUNT(*) as count FROM patients WHERE tenant_id IS NULL AND deleted_at IS NULL`
  );

  console.log(`\n📊 Remaining without tenant_id:`);
  console.log(`   Users: ${usersWithoutTenant[0].count}`);
  console.log(`   Patients: ${patientsWithoutTenant[0].count}`);

  if (parseInt(usersWithoutTenant[0].count) > 0 || parseInt(patientsWithoutTenant[0].count) > 0) {
    // Get first tenant as fallback
    const tenants = await dataSource.query(`SELECT id, name FROM tenants LIMIT 1`);
    if (tenants.length > 0) {
      console.log(`\n💡 Consider assigning remaining records to default tenant: ${tenants[0].name} (${tenants[0].id})`);
    }
  }

  console.log('\n✅ Backfill complete!');
  await dataSource.destroy();
}

backfill().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
