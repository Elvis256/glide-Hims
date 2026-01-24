import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Item, StockBalance, StockLedger, MovementType } from '../entities/inventory.entity';
import { Facility } from '../entities/facility.entity';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { Department } from '../entities/department.entity';
import { AuditLog } from '../entities/audit-log.entity';

// Sample drugs and supplies
const sampleItems = [
  // Common drugs
  { code: 'PARA500', name: 'Paracetamol 500mg', category: 'Analgesics', unit: 'tablet', isDrug: true, requiresPrescription: false, reorderLevel: 100, unitCost: 50, sellingPrice: 100 },
  { code: 'AMOX500', name: 'Amoxicillin 500mg', category: 'Antibiotics', unit: 'capsule', isDrug: true, requiresPrescription: true, reorderLevel: 50, unitCost: 200, sellingPrice: 400 },
  { code: 'METR400', name: 'Metronidazole 400mg', category: 'Antibiotics', unit: 'tablet', isDrug: true, requiresPrescription: true, reorderLevel: 50, unitCost: 150, sellingPrice: 300 },
  { code: 'CIPR500', name: 'Ciprofloxacin 500mg', category: 'Antibiotics', unit: 'tablet', isDrug: true, requiresPrescription: true, reorderLevel: 30, unitCost: 300, sellingPrice: 600 },
  { code: 'IBUP400', name: 'Ibuprofen 400mg', category: 'Analgesics', unit: 'tablet', isDrug: true, requiresPrescription: false, reorderLevel: 100, unitCost: 80, sellingPrice: 150 },
  { code: 'OMEP20', name: 'Omeprazole 20mg', category: 'GI Drugs', unit: 'capsule', isDrug: true, requiresPrescription: true, reorderLevel: 50, unitCost: 250, sellingPrice: 500 },
  { code: 'LORA10', name: 'Loratadine 10mg', category: 'Antihistamines', unit: 'tablet', isDrug: true, requiresPrescription: false, reorderLevel: 50, unitCost: 100, sellingPrice: 200 },
  { code: 'DIAZ5', name: 'Diazepam 5mg', category: 'Sedatives', unit: 'tablet', isDrug: true, requiresPrescription: true, reorderLevel: 20, unitCost: 150, sellingPrice: 300 },
  { code: 'ARTEM20', name: 'Artemether/Lumefantrine 20/120mg', category: 'Antimalarials', unit: 'tablet', isDrug: true, requiresPrescription: true, reorderLevel: 100, unitCost: 500, sellingPrice: 1000 },
  { code: 'COTI', name: 'Cotrimoxazole 480mg', category: 'Antibiotics', unit: 'tablet', isDrug: true, requiresPrescription: true, reorderLevel: 50, unitCost: 100, sellingPrice: 200 },
  // Injectables
  { code: 'DEXT5', name: 'Dextrose 5% 500ml', category: 'IV Fluids', unit: 'bottle', isDrug: true, requiresPrescription: true, reorderLevel: 20, unitCost: 3000, sellingPrice: 5000 },
  { code: 'NS09', name: 'Normal Saline 0.9% 500ml', category: 'IV Fluids', unit: 'bottle', isDrug: true, requiresPrescription: true, reorderLevel: 20, unitCost: 2500, sellingPrice: 4000 },
  { code: 'GENT80', name: 'Gentamicin 80mg/2ml', category: 'Antibiotics', unit: 'ampoule', isDrug: true, requiresPrescription: true, reorderLevel: 30, unitCost: 500, sellingPrice: 1000 },
  // Supplies
  { code: 'SYR5ML', name: 'Syringe 5ml', category: 'Medical Supplies', unit: 'piece', isDrug: false, requiresPrescription: false, reorderLevel: 100, unitCost: 300, sellingPrice: 500 },
  { code: 'SYR10ML', name: 'Syringe 10ml', category: 'Medical Supplies', unit: 'piece', isDrug: false, requiresPrescription: false, reorderLevel: 100, unitCost: 400, sellingPrice: 700 },
  { code: 'GLVLAT', name: 'Latex Gloves (Box 100)', category: 'Medical Supplies', unit: 'box', isDrug: false, requiresPrescription: false, reorderLevel: 10, unitCost: 25000, sellingPrice: 35000 },
  { code: 'COTTWL', name: 'Cotton Wool 500g', category: 'Medical Supplies', unit: 'roll', isDrug: false, requiresPrescription: false, reorderLevel: 20, unitCost: 5000, sellingPrice: 8000 },
  { code: 'BANDG', name: 'Bandage Gauze 4"', category: 'Medical Supplies', unit: 'roll', isDrug: false, requiresPrescription: false, reorderLevel: 50, unitCost: 1000, sellingPrice: 2000 },
  { code: 'CANNULA', name: 'IV Cannula 20G', category: 'Medical Supplies', unit: 'piece', isDrug: false, requiresPrescription: false, reorderLevel: 50, unitCost: 800, sellingPrice: 1500 },
  { code: 'FACEMSK', name: 'Face Mask (Box 50)', category: 'PPE', unit: 'box', isDrug: false, requiresPrescription: false, reorderLevel: 10, unitCost: 15000, sellingPrice: 25000 },
];

// Sample patients
const samplePatients = [
  { mrn: 'MRN00001', fullName: 'John Kato', gender: 'male', dateOfBirth: '1985-03-15', phone: '+256701234567', nationalId: 'CM85015034567A' },
  { mrn: 'MRN00002', fullName: 'Sarah Namugga', gender: 'female', dateOfBirth: '1990-07-22', phone: '+256702345678', nationalId: 'CF90022245678B' },
  { mrn: 'MRN00003', fullName: 'Peter Ochieng', gender: 'male', dateOfBirth: '1978-11-08', phone: '+256703456789', nationalId: 'CM78030856789C' },
  { mrn: 'MRN00004', fullName: 'Grace Nakato', gender: 'female', dateOfBirth: '1995-01-30', phone: '+256704567890', nationalId: 'CF95013067890D' },
  { mrn: 'MRN00005', fullName: 'David Mugisha', gender: 'male', dateOfBirth: '1982-06-12', phone: '+256705678901', nationalId: 'CM82016278901E' },
  { mrn: 'MRN00006', fullName: 'Mary Achieng', gender: 'female', dateOfBirth: '1988-09-25', phone: '+256706789012', nationalId: 'CF88092589012F' },
  { mrn: 'MRN00007', fullName: 'James Ssempala', gender: 'male', dateOfBirth: '1975-04-18', phone: '+256707890123', nationalId: 'CM75041890123G' },
  { mrn: 'MRN00008', fullName: 'Agnes Namutebi', gender: 'female', dateOfBirth: '2000-12-05', phone: '+256708901234', nationalId: 'CF00120501234H' },
  { mrn: 'MRN00009', fullName: 'Robert Okello', gender: 'male', dateOfBirth: '1992-08-20', phone: '+256709012345', nationalId: 'CM92082012345I' },
  { mrn: 'MRN00010', fullName: 'Florence Atim', gender: 'female', dateOfBirth: '1987-02-14', phone: '+256710123456', nationalId: 'CF87021423456J' },
];

export async function seedClinicalData(dataSource: DataSource) {
  console.log('🌱 Starting clinical data seed...\n');

  const itemRepo = dataSource.getRepository(Item);
  const patientRepo = dataSource.getRepository(Patient);
  const stockBalanceRepo = dataSource.getRepository(StockBalance);
  const stockLedgerRepo = dataSource.getRepository(StockLedger);
  const facilityRepo = dataSource.getRepository(Facility);
  const userRepo = dataSource.getRepository(User);

  // Get default facility and admin user
  const facility = await facilityRepo.findOne({ where: { name: 'Main Hospital' } });
  const adminUser = await userRepo.findOne({ where: { username: 'admin' } });

  if (!facility) {
    console.log('❌ Default facility not found. Run base seed first.');
    return;
  }

  if (!adminUser) {
    console.log('❌ Admin user not found. Run base seed first.');
    return;
  }

  // 1. Create Items
  console.log('💊 Creating items...');
  const items: Item[] = [];
  for (const itemData of sampleItems) {
    let item = await itemRepo.findOne({ where: { code: itemData.code } });
    if (!item) {
      item = await itemRepo.save(itemRepo.create({
        ...itemData,
        status: 'active',
      }));
      console.log(`  ✓ Created item: ${itemData.name}`);
    }
    items.push(item);
  }
  console.log(`  Total items: ${items.length}`);

  // 2. Create initial stock for items
  console.log('\n📦 Creating initial stock...');
  for (const item of items) {
    const existingBalance = await stockBalanceRepo.findOne({
      where: { itemId: item.id, facilityId: facility.id },
    });

    if (!existingBalance) {
      // Random initial quantity between 50-200 for drugs, 20-50 for supplies
      const initialQty = item.isDrug ? Math.floor(Math.random() * 150) + 50 : Math.floor(Math.random() * 30) + 20;

      // Create stock ledger entry
      const ledger = await stockLedgerRepo.save(stockLedgerRepo.create({
        itemId: item.id,
        facilityId: facility.id,
        quantity: initialQty,
        balanceAfter: initialQty,
        movementType: MovementType.PURCHASE,
        unitCost: item.unitCost,
        batchNumber: `INIT${Date.now().toString().slice(-6)}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        notes: 'Initial stock seeding',
        createdById: adminUser.id,
      }));

      // Create stock balance
      await stockBalanceRepo.save(stockBalanceRepo.create({
        itemId: item.id,
        facilityId: facility.id,
        totalQuantity: initialQty,
        reservedQuantity: 0,
        availableQuantity: initialQty,
        lastMovementAt: new Date(),
      }));

      console.log(`  ✓ ${item.name}: ${initialQty} ${item.unit}(s)`);
    }
  }

  // 3. Create Patients
  console.log('\n👥 Creating patients...');
  for (const patientData of samplePatients) {
    let patient = await patientRepo.findOne({ where: { mrn: patientData.mrn } });
    if (!patient) {
      patient = await patientRepo.save(patientRepo.create({
        ...patientData,
        dateOfBirth: new Date(patientData.dateOfBirth),
        status: 'active',
        address: 'Kampala, Central Uganda',
        nextOfKin: {
          name: 'Next of Kin',
          phone: patientData.phone,
          relationship: 'Spouse',
        },
      }));
      console.log(`  ✓ Created patient: ${patientData.fullName} (${patientData.mrn})`);
    }
  }

  console.log('\n✅ Clinical data seed completed!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Items created: ${sampleItems.length}`);
  console.log(`  Patients created: ${samplePatients.length}`);
  console.log('═══════════════════════════════════════════════════\n');
}

// Run seed if executed directly
async function runClinicalSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'glide_hims',
    password: process.env.DB_PASSWORD || 'glide_hims_dev',
    database: process.env.DB_NAME || 'glide_hims_dev',
    entities: [
      Tenant,
      Facility,
      Department,
      Role,
      Permission,
      RolePermission,
      User,
      UserRole,
      Patient,
      AuditLog,
      Item,
      StockBalance,
      StockLedger,
    ],
    synchronize: false,
  });

  await dataSource.initialize();
  await seedClinicalData(dataSource);
  await dataSource.destroy();
}

runClinicalSeed().catch((error) => {
  console.error('Clinical seed failed:', error);
  process.exit(1);
});
