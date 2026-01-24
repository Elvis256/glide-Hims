import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const DEFAULT_FACILITY_ID = 'b94b30c8-f98e-4a70-825e-253224a1cb91';

const insuranceProviders = [
  // National Health Insurance
  {
    name: 'Uganda National Health Insurance Scheme (UNHIS)',
    code: 'UNHIS',
    providerType: 'nhis',
    contactPerson: 'NHIS Support',
    email: 'claims@nhis.go.ug',
    phone: '+256-41-4340000',
    address: 'Plot 12, Bombo Road, Kampala, Uganda',
    claimSubmissionMethod: 'portal',
    paymentTermsDays: 45,
  },
  // Private Insurance Companies
  {
    name: 'UAP Old Mutual Insurance',
    code: 'UAP',
    providerType: 'private',
    contactPerson: 'Claims Department',
    email: 'medical.claims@uap.co.ug',
    phone: '+256-41-4230700',
    address: 'UAP Business Park, Nakasero, Kampala',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 30,
  },
  {
    name: 'Jubilee Health Insurance',
    code: 'JHI',
    providerType: 'private',
    contactPerson: 'Claims Manager',
    email: 'health.claims@jubileeuganda.com',
    phone: '+256-41-4231940',
    address: 'Jubilee Insurance Centre, Parliament Avenue, Kampala',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 30,
  },
  {
    name: 'AAR Healthcare',
    code: 'AAR',
    providerType: 'private',
    contactPerson: 'Medical Claims',
    email: 'claims@aar.co.ug',
    phone: '+256-41-4560900',
    address: 'AAR House, Lourdel Road, Kampala',
    claimSubmissionMethod: 'portal',
    paymentTermsDays: 21,
  },
  {
    name: 'GA Insurance',
    code: 'GAI',
    providerType: 'private',
    contactPerson: 'Health Claims',
    email: 'medical@ga-insurance.com',
    phone: '+256-41-4344460',
    address: 'Plot 24, Kampala Road, Kampala',
    claimSubmissionMethod: 'manual',
    paymentTermsDays: 30,
  },
  {
    name: 'First Insurance Company',
    code: 'FIC',
    providerType: 'private',
    contactPerson: 'Claims Unit',
    email: 'health@firstinsurance.co.ug',
    phone: '+256-41-4255900',
    address: 'First Insurance Building, Jinja Road, Kampala',
    claimSubmissionMethod: 'manual',
    paymentTermsDays: 30,
  },
  {
    name: 'Sanlam General Insurance',
    code: 'SGI',
    providerType: 'private',
    contactPerson: 'Medical Claims',
    email: 'claims@sanlam.co.ug',
    phone: '+256-41-4310700',
    address: 'Workers House, Plot 1, Pilkington Road, Kampala',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 30,
  },
  {
    name: 'Prudential Assurance',
    code: 'PAU',
    providerType: 'private',
    contactPerson: 'Health Division',
    email: 'health.claims@prudential.co.ug',
    phone: '+256-41-4340555',
    address: 'Prudential Building, Kampala Road',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 30,
  },
  // Corporate/Employer Insurance
  {
    name: 'MTN Staff Medical Scheme',
    code: 'MTN-MED',
    providerType: 'corporate',
    contactPerson: 'HR Medical Benefits',
    email: 'medical@mtn.co.ug',
    phone: '+256-31-2123456',
    address: 'MTN Tower, Hannington Road, Kampala',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 14,
  },
  {
    name: 'Stanbic Bank Medical Scheme',
    code: 'SBU-MED',
    providerType: 'corporate',
    contactPerson: 'Employee Benefits',
    email: 'benefits@stanbic.co.ug',
    phone: '+256-41-4231000',
    address: 'Stanbic House, Crested Towers, Kampala',
    claimSubmissionMethod: 'electronic',
    paymentTermsDays: 14,
  },
  // Government Schemes
  {
    name: 'Uganda Government Civil Service Scheme',
    code: 'UGCSS',
    providerType: 'government',
    contactPerson: 'Ministry of Public Service',
    email: 'medical@publicservice.go.ug',
    phone: '+256-41-4250570',
    address: 'Ministry of Public Service, Kampala',
    claimSubmissionMethod: 'manual',
    paymentTermsDays: 60,
  },
  {
    name: 'Uganda Police Medical Scheme',
    code: 'UPMS',
    providerType: 'government',
    contactPerson: 'Police Medical Unit',
    email: 'medical@police.go.ug',
    phone: '+256-41-4254613',
    address: 'Police Headquarters, Kampala',
    claimSubmissionMethod: 'manual',
    paymentTermsDays: 60,
  },
];

async function seedProviders() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'glide_hims',
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  for (const provider of insuranceProviders) {
    const exists = await dataSource.query(
      'SELECT id FROM insurance_providers WHERE code = $1',
      [provider.code]
    );

    if (exists.length === 0) {
      await dataSource.query(
        `INSERT INTO insurance_providers (
          id, facility_id, name, code, provider_type, contact_person, 
          email, phone, address, claim_submission_method, payment_terms_days, is_active
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true
        )`,
        [
          DEFAULT_FACILITY_ID,
          provider.name,
          provider.code,
          provider.providerType,
          provider.contactPerson,
          provider.email,
          provider.phone,
          provider.address,
          provider.claimSubmissionMethod,
          provider.paymentTermsDays,
        ]
      );
      console.log(`Created provider: ${provider.name} (${provider.code})`);
    } else {
      console.log(`Provider already exists: ${provider.name}`);
    }
  }

  console.log(`\n✅ Seeded ${insuranceProviders.length} insurance providers`);
  await dataSource.destroy();
}

seedProviders().catch(console.error);
