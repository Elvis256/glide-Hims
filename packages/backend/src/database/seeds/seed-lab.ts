import { DataSource } from 'typeorm';
import { LabTest, LabTestCategory, LabTestStatus, SampleType } from '../entities/lab-test.entity';
import { Facility } from '../entities/facility.entity';

// Helper to map sample type strings to enum
function mapSampleType(sample: string): SampleType {
  const mapping: Record<string, SampleType> = {
    'EDTA Blood': SampleType.BLOOD,
    'Citrate Blood': SampleType.BLOOD,
    'Serum': SampleType.SERUM,
    'Fasting Serum': SampleType.SERUM,
    'Plasma': SampleType.PLASMA,
    'EDTA Plasma': SampleType.PLASMA,
    'Urine': SampleType.URINE,
    'Stool': SampleType.STOOL,
    'Sputum': SampleType.SPUTUM,
    'Various': SampleType.OTHER,
    'Capillary Blood': SampleType.BLOOD,
    'Fluoride Blood': SampleType.BLOOD,
    'Aspirate': SampleType.OTHER,
    'Tissue': SampleType.TISSUE,
    'Cervical Smear': SampleType.SWAB,
  };
  return mapping[sample] || SampleType.OTHER;
}

// Uganda-relevant lab test catalog
const labTests = [
  // Hematology
  {
    code: 'CBC',
    name: 'Complete Blood Count',
    category: LabTestCategory.HEMATOLOGY,
    description: 'Full blood count including RBC, WBC, platelets, hemoglobin',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 60,
    price: 15000,
    referenceRanges: [
      { parameter: 'Hemoglobin', unit: 'g/dL', normalMin: 12, normalMax: 17, criticalLow: 7, criticalHigh: 20 },
      { parameter: 'WBC', unit: 'x10^9/L', normalMin: 4, normalMax: 11, criticalLow: 2, criticalHigh: 30 },
      { parameter: 'Platelets', unit: 'x10^9/L', normalMin: 150, normalMax: 400, criticalLow: 50, criticalHigh: 1000 },
      { parameter: 'RBC', unit: 'x10^12/L', normalMin: 4.0, normalMax: 5.5, criticalLow: 2.5, criticalHigh: 7 },
      { parameter: 'Hematocrit', unit: '%', normalMin: 36, normalMax: 50, criticalLow: 20, criticalHigh: 60 },
    ],
  },
  {
    code: 'HGB',
    name: 'Hemoglobin',
    category: LabTestCategory.HEMATOLOGY,
    description: 'Hemoglobin level only',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 30,
    price: 5000,
    referenceRanges: [
      { parameter: 'Hemoglobin', unit: 'g/dL', normalMin: 12, normalMax: 17, criticalLow: 7, criticalHigh: 20 },
    ],
  },
  {
    code: 'DIFF',
    name: 'Differential Count',
    category: LabTestCategory.HEMATOLOGY,
    description: 'WBC differential count',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 45,
    price: 10000,
    referenceRanges: [
      { parameter: 'Neutrophils', unit: '%', normalMin: 40, normalMax: 70 },
      { parameter: 'Lymphocytes', unit: '%', normalMin: 20, normalMax: 40 },
      { parameter: 'Monocytes', unit: '%', normalMin: 2, normalMax: 8 },
      { parameter: 'Eosinophils', unit: '%', normalMin: 1, normalMax: 4 },
      { parameter: 'Basophils', unit: '%', normalMin: 0, normalMax: 1 },
    ],
  },
  {
    code: 'ESR',
    name: 'Erythrocyte Sedimentation Rate',
    category: LabTestCategory.HEMATOLOGY,
    description: 'ESR Westergren method',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 60,
    price: 5000,
    referenceRanges: [
      { parameter: 'ESR', unit: 'mm/hr', normalMin: 0, normalMax: 20, criticalHigh: 100 },
    ],
  },
  {
    code: 'COAG',
    name: 'Coagulation Screen',
    category: LabTestCategory.HEMATOLOGY,
    description: 'PT, PTT, INR',
    sampleType: 'Citrate Blood',
    turnaroundMinutes: 90,
    price: 25000,
    referenceRanges: [
      { parameter: 'PT', unit: 'seconds', normalMin: 11, normalMax: 13.5, criticalHigh: 20 },
      { parameter: 'PTT', unit: 'seconds', normalMin: 25, normalMax: 35, criticalHigh: 60 },
      { parameter: 'INR', unit: '', normalMin: 0.8, normalMax: 1.2, criticalHigh: 4 },
    ],
  },

  // Chemistry
  {
    code: 'RFT',
    name: 'Renal Function Tests',
    category: LabTestCategory.CHEMISTRY,
    description: 'Creatinine, BUN, Electrolytes',
    sampleType: 'Serum',
    turnaroundMinutes: 120,
    price: 35000,
    referenceRanges: [
      { parameter: 'Creatinine', unit: 'mg/dL', normalMin: 0.6, normalMax: 1.2, criticalLow: 0.3, criticalHigh: 10 },
      { parameter: 'BUN', unit: 'mg/dL', normalMin: 7, normalMax: 20, criticalHigh: 100 },
      { parameter: 'Sodium', unit: 'mEq/L', normalMin: 136, normalMax: 145, criticalLow: 120, criticalHigh: 160 },
      { parameter: 'Potassium', unit: 'mEq/L', normalMin: 3.5, normalMax: 5.0, criticalLow: 2.5, criticalHigh: 6.5 },
      { parameter: 'Chloride', unit: 'mEq/L', normalMin: 98, normalMax: 106, criticalLow: 80, criticalHigh: 120 },
    ],
  },
  {
    code: 'LFT',
    name: 'Liver Function Tests',
    category: LabTestCategory.CHEMISTRY,
    description: 'ALT, AST, ALP, Bilirubin, Albumin',
    sampleType: 'Serum',
    turnaroundMinutes: 120,
    price: 40000,
    referenceRanges: [
      { parameter: 'ALT', unit: 'U/L', normalMin: 7, normalMax: 56, criticalHigh: 1000 },
      { parameter: 'AST', unit: 'U/L', normalMin: 10, normalMax: 40, criticalHigh: 1000 },
      { parameter: 'ALP', unit: 'U/L', normalMin: 44, normalMax: 147 },
      { parameter: 'Total Bilirubin', unit: 'mg/dL', normalMin: 0.1, normalMax: 1.2, criticalHigh: 15 },
      { parameter: 'Direct Bilirubin', unit: 'mg/dL', normalMin: 0, normalMax: 0.3 },
      { parameter: 'Albumin', unit: 'g/dL', normalMin: 3.5, normalMax: 5.5, criticalLow: 2.0 },
    ],
  },
  {
    code: 'LIPID',
    name: 'Lipid Profile',
    category: LabTestCategory.CHEMISTRY,
    description: 'Total Cholesterol, HDL, LDL, Triglycerides',
    sampleType: 'Fasting Serum',
    turnaroundMinutes: 90,
    price: 30000,
    referenceRanges: [
      { parameter: 'Total Cholesterol', unit: 'mg/dL', normalMin: 0, normalMax: 200, criticalHigh: 400 },
      { parameter: 'HDL', unit: 'mg/dL', normalMin: 40, normalMax: 60 },
      { parameter: 'LDL', unit: 'mg/dL', normalMin: 0, normalMax: 100, criticalHigh: 250 },
      { parameter: 'Triglycerides', unit: 'mg/dL', normalMin: 0, normalMax: 150, criticalHigh: 500 },
    ],
  },
  {
    code: 'RBS',
    name: 'Random Blood Sugar',
    category: LabTestCategory.CHEMISTRY,
    description: 'Random glucose level',
    sampleType: 'Fluoride Blood',
    turnaroundMinutes: 30,
    price: 5000,
    referenceRanges: [
      { parameter: 'Glucose', unit: 'mg/dL', normalMin: 70, normalMax: 140, criticalLow: 40, criticalHigh: 500 },
    ],
  },
  {
    code: 'FBS',
    name: 'Fasting Blood Sugar',
    category: LabTestCategory.CHEMISTRY,
    description: 'Fasting glucose level',
    sampleType: 'Fluoride Blood',
    turnaroundMinutes: 30,
    price: 5000,
    referenceRanges: [
      { parameter: 'Fasting Glucose', unit: 'mg/dL', normalMin: 70, normalMax: 100, criticalLow: 40, criticalHigh: 500 },
    ],
  },
  {
    code: 'HBA1C',
    name: 'Glycated Hemoglobin',
    category: LabTestCategory.CHEMISTRY,
    description: 'HbA1c for diabetes monitoring',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 120,
    price: 35000,
    referenceRanges: [
      { parameter: 'HbA1c', unit: '%', normalMin: 4, normalMax: 5.6, criticalHigh: 14 },
    ],
  },

  // Microbiology
  {
    code: 'MALARIA',
    name: 'Malaria Parasites',
    category: LabTestCategory.MICROBIOLOGY,
    description: 'Blood smear for malaria parasites (thick and thin films)',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 30,
    price: 10000,
    referenceRanges: [
      { parameter: 'Malaria Parasites', unit: '', textNormal: 'Not Seen' },
    ],
  },
  {
    code: 'MRDT',
    name: 'Malaria RDT',
    category: LabTestCategory.MICROBIOLOGY,
    description: 'Malaria Rapid Diagnostic Test',
    sampleType: 'Capillary Blood',
    turnaroundMinutes: 15,
    price: 8000,
    referenceRanges: [
      { parameter: 'mRDT', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'URINE',
    name: 'Urinalysis',
    category: LabTestCategory.URINALYSIS,
    description: 'Complete urine analysis including microscopy',
    sampleType: 'Urine',
    turnaroundMinutes: 45,
    price: 10000,
    referenceRanges: [
      { parameter: 'pH', unit: '', normalMin: 4.5, normalMax: 8 },
      { parameter: 'Specific Gravity', unit: '', normalMin: 1.005, normalMax: 1.030 },
      { parameter: 'Protein', unit: '', textNormal: 'Negative' },
      { parameter: 'Glucose', unit: '', textNormal: 'Negative' },
      { parameter: 'Blood', unit: '', textNormal: 'Negative' },
      { parameter: 'WBC', unit: '/hpf', normalMin: 0, normalMax: 5 },
      { parameter: 'RBC', unit: '/hpf', normalMin: 0, normalMax: 2 },
    ],
  },
  {
    code: 'STOOL',
    name: 'Stool Analysis',
    category: LabTestCategory.PARASITOLOGY,
    description: 'Stool microscopy and occult blood',
    sampleType: 'Stool',
    turnaroundMinutes: 45,
    price: 10000,
    referenceRanges: [
      { parameter: 'Ova', unit: '', textNormal: 'Not Seen' },
      { parameter: 'Cysts', unit: '', textNormal: 'Not Seen' },
      { parameter: 'Occult Blood', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'CULTURE',
    name: 'Culture & Sensitivity',
    category: LabTestCategory.MICROBIOLOGY,
    description: 'Bacterial culture with antibiotic sensitivity',
    sampleType: 'Various',
    turnaroundMinutes: 4320, // 72 hours
    price: 50000,
    referenceRanges: [
      { parameter: 'Culture', unit: '', textNormal: 'No Growth' },
    ],
  },
  {
    code: 'GRAMSTAIN',
    name: 'Gram Stain',
    category: LabTestCategory.MICROBIOLOGY,
    description: 'Gram stain for bacteria',
    sampleType: 'Various',
    turnaroundMinutes: 30,
    price: 8000,
    referenceRanges: [
      { parameter: 'Gram Stain', unit: '', textNormal: 'No organisms seen' },
    ],
  },

  // Serology/Immunology
  {
    code: 'HIV',
    name: 'HIV Screening',
    category: LabTestCategory.SEROLOGY,
    description: 'HIV 1/2 antibody test',
    sampleType: 'Serum',
    turnaroundMinutes: 30,
    price: 10000,
    referenceRanges: [
      { parameter: 'HIV 1/2 Ab', unit: '', textNormal: 'Non-Reactive' },
    ],
  },
  {
    code: 'VDRL',
    name: 'VDRL/RPR',
    category: LabTestCategory.SEROLOGY,
    description: 'Syphilis screening test',
    sampleType: 'Serum',
    turnaroundMinutes: 30,
    price: 8000,
    referenceRanges: [
      { parameter: 'VDRL', unit: '', textNormal: 'Non-Reactive' },
    ],
  },
  {
    code: 'HBSAG',
    name: 'Hepatitis B Surface Antigen',
    category: LabTestCategory.SEROLOGY,
    description: 'HBsAg screening',
    sampleType: 'Serum',
    turnaroundMinutes: 30,
    price: 15000,
    referenceRanges: [
      { parameter: 'HBsAg', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'HCV',
    name: 'Hepatitis C Antibody',
    category: LabTestCategory.SEROLOGY,
    description: 'Anti-HCV screening',
    sampleType: 'Serum',
    turnaroundMinutes: 30,
    price: 15000,
    referenceRanges: [
      { parameter: 'Anti-HCV', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'WIDAL',
    name: 'Widal Test',
    category: LabTestCategory.SEROLOGY,
    description: 'Typhoid fever screening',
    sampleType: 'Serum',
    turnaroundMinutes: 60,
    price: 10000,
    referenceRanges: [
      { parameter: 'TO', unit: 'titer', textNormal: '<1:80' },
      { parameter: 'TH', unit: 'titer', textNormal: '<1:80' },
    ],
  },
  {
    code: 'BRUCELLA',
    name: 'Brucella Antibodies',
    category: LabTestCategory.SEROLOGY,
    description: 'Brucellosis screening',
    sampleType: 'Serum',
    turnaroundMinutes: 60,
    price: 15000,
    referenceRanges: [
      { parameter: 'Brucella Ab', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'PREG',
    name: 'Pregnancy Test (Serum)',
    category: LabTestCategory.SEROLOGY,
    description: 'Beta-hCG qualitative',
    sampleType: 'Serum',
    turnaroundMinutes: 30,
    price: 10000,
    referenceRanges: [
      { parameter: 'Beta-hCG', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'UPREGTEST',
    name: 'Urine Pregnancy Test',
    category: LabTestCategory.SEROLOGY,
    description: 'Urine hCG qualitative',
    sampleType: 'Urine',
    turnaroundMinutes: 15,
    price: 5000,
    referenceRanges: [
      { parameter: 'Urine hCG', unit: '', textNormal: 'Negative' },
    ],
  },
  {
    code: 'BHCG',
    name: 'Beta-hCG Quantitative',
    category: LabTestCategory.SEROLOGY,
    description: 'Quantitative pregnancy hormone',
    sampleType: 'Serum',
    turnaroundMinutes: 120,
    price: 25000,
    referenceRanges: [
      { parameter: 'Beta-hCG', unit: 'mIU/mL', normalMin: 0, normalMax: 5 },
    ],
  },

  // Other Common Tests
  {
    code: 'CD4',
    name: 'CD4 Count',
    category: LabTestCategory.IMMUNOLOGY,
    description: 'CD4 lymphocyte count for HIV monitoring',
    sampleType: 'EDTA Blood',
    turnaroundMinutes: 240,
    price: 30000,
    referenceRanges: [
      { parameter: 'CD4 Count', unit: 'cells/µL', normalMin: 500, normalMax: 1500, criticalLow: 200 },
      { parameter: 'CD4 %', unit: '%', normalMin: 30, normalMax: 60, criticalLow: 14 },
    ],
  },
  {
    code: 'VIRALLOAD',
    name: 'HIV Viral Load',
    category: LabTestCategory.MOLECULAR,
    description: 'HIV RNA quantification',
    sampleType: 'EDTA Plasma',
    turnaroundMinutes: 10080, // 7 days (often sent out)
    price: 100000,
    referenceRanges: [
      { parameter: 'Viral Load', unit: 'copies/mL', textNormal: 'Target Not Detected' },
    ],
  },
  {
    code: 'TSH',
    name: 'Thyroid Stimulating Hormone',
    category: LabTestCategory.CHEMISTRY,
    description: 'TSH for thyroid screening',
    sampleType: 'Serum',
    turnaroundMinutes: 180,
    price: 35000,
    referenceRanges: [
      { parameter: 'TSH', unit: 'mIU/L', normalMin: 0.4, normalMax: 4.0, criticalLow: 0.1, criticalHigh: 10 },
    ],
  },
  {
    code: 'TFT',
    name: 'Thyroid Function Tests',
    category: LabTestCategory.CHEMISTRY,
    description: 'TSH, T3, T4',
    sampleType: 'Serum',
    turnaroundMinutes: 180,
    price: 60000,
    referenceRanges: [
      { parameter: 'TSH', unit: 'mIU/L', normalMin: 0.4, normalMax: 4.0, criticalLow: 0.1, criticalHigh: 10 },
      { parameter: 'T3', unit: 'ng/dL', normalMin: 80, normalMax: 200 },
      { parameter: 'T4', unit: 'µg/dL', normalMin: 5, normalMax: 12 },
    ],
  },
  {
    code: 'PSA',
    name: 'Prostate Specific Antigen',
    category: LabTestCategory.CHEMISTRY,
    description: 'PSA for prostate screening',
    sampleType: 'Serum',
    turnaroundMinutes: 180,
    price: 40000,
    referenceRanges: [
      { parameter: 'PSA', unit: 'ng/mL', normalMin: 0, normalMax: 4, criticalHigh: 10 },
    ],
  },
  {
    code: 'URICACID',
    name: 'Uric Acid',
    category: LabTestCategory.CHEMISTRY,
    description: 'Serum uric acid level',
    sampleType: 'Serum',
    turnaroundMinutes: 60,
    price: 10000,
    referenceRanges: [
      { parameter: 'Uric Acid', unit: 'mg/dL', normalMin: 3.5, normalMax: 7.2, criticalHigh: 12 },
    ],
  },
];

export async function seedLabTests(dataSource: DataSource) {
  console.log('🧪 Starting lab test seed...\n');

  const labTestRepo = dataSource.getRepository(LabTest);
  const facilityRepo = dataSource.getRepository(Facility);

  const facility = await facilityRepo.findOne({ where: { name: 'Main Hospital' } });
  if (!facility) {
    console.log('❌ Default facility not found. Run base seed first.');
    return;
  }

  // Check if lab tests already exist
  const existingCount = await labTestRepo.count();
  if (existingCount > 0) {
    console.log(`✅ Lab tests already seeded (${existingCount} tests found)`);
    return;
  }

  let created = 0;
  for (const test of labTests) {
    const labTest = labTestRepo.create({
      code: test.code,
      name: test.name,
      category: test.category,
      description: test.description,
      sampleType: mapSampleType(test.sampleType),
      turnaroundTimeMinutes: test.turnaroundMinutes,
      price: test.price,
      referenceRanges: test.referenceRanges,
      status: LabTestStatus.ACTIVE,
    });
    await labTestRepo.save(labTest);
    created++;
  }

  console.log(`✅ Created ${created} lab tests`);
  console.log('\n📋 Lab Test Categories:');
  console.log('   - Hematology: CBC, Hemoglobin, Differential, ESR, Coagulation, CD4');
  console.log('   - Chemistry: RFT, LFT, Lipids, Blood Sugar, HbA1c, Thyroid, PSA');
  console.log('   - Microbiology: Malaria, Urinalysis, Stool, Culture, Viral Load');
  console.log('   - Serology: HIV, Hepatitis B/C, VDRL, Widal, Pregnancy');
  console.log('\n🧪 Lab test seed complete!\n');
}

// Run if called directly
async function runLabSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'glide_hims',
    password: process.env.DB_PASSWORD || 'glide_hims_dev',
    database: process.env.DB_NAME || 'glide_hims_dev',
    entities: [__dirname + '/../entities/*.entity.{js,ts}'],
    synchronize: false,
  });

  await dataSource.initialize();
  await seedLabTests(dataSource);
  await dataSource.destroy();
}

if (require.main === module) {
  runLabSeed().catch((error) => {
    console.error('Lab seed failed:', error);
    process.exit(1);
  });
}
