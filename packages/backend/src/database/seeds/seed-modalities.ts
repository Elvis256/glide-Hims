import { DataSource } from 'typeorm';
import { ImagingModality, ModalityType } from '../entities/imaging-modality.entity';
import { Facility } from '../entities/facility.entity';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'glide_hims',
  password: process.env.DB_PASSWORD || 'glide_hims_dev',
  database: process.env.DB_NAME || 'glide_hims_dev',
  entities: [ImagingModality, Facility, Tenant, User, Role, Permission],
  synchronize: false,
});

async function seedModalities() {
  await dataSource.initialize();
  console.log('Connected to database');

  const modalityRepo = dataSource.getRepository(ImagingModality);
  const facilityRepo = dataSource.getRepository(Facility);

  const facility = await facilityRepo.findOne({ where: {} });
  if (!facility) {
    console.error('No facility found. Run main seed first.');
    await dataSource.destroy();
    return;
  }

  const modalities = [
    // X-Ray
    {
      name: 'X-Ray Room 1',
      modalityType: ModalityType.XRAY,
      manufacturer: 'Siemens',
      model: 'Ysio Max',
      location: 'Radiology Wing, Ground Floor',
    },
    {
      name: 'X-Ray Room 2 (Mobile)',
      modalityType: ModalityType.XRAY,
      manufacturer: 'GE Healthcare',
      model: 'Optima XR220amx',
      location: 'Mobile Unit',
    },
    // Ultrasound
    {
      name: 'Ultrasound Room 1',
      modalityType: ModalityType.ULTRASOUND,
      manufacturer: 'Philips',
      model: 'EPIQ 7',
      location: 'Radiology Wing, Room 3',
    },
    {
      name: 'Ultrasound Room 2 (OB/GYN)',
      modalityType: ModalityType.ULTRASOUND,
      manufacturer: 'GE Healthcare',
      model: 'Voluson E10',
      location: 'Maternity Wing',
    },
    {
      name: 'Portable Ultrasound',
      modalityType: ModalityType.ULTRASOUND,
      manufacturer: 'Sonosite',
      model: 'Edge II',
      location: 'Emergency/ICU',
    },
    // CT
    {
      name: 'CT Scanner',
      modalityType: ModalityType.CT,
      manufacturer: 'Siemens',
      model: 'SOMATOM go.Top',
      location: 'Radiology Wing, Room 5',
    },
    // Echocardiogram
    {
      name: 'Echo Room',
      modalityType: ModalityType.ECHOCARDIOGRAM,
      manufacturer: 'Philips',
      model: 'EPIQ CVx',
      location: 'Cardiology Unit',
    },
    // Fluoroscopy
    {
      name: 'Fluoroscopy Room',
      modalityType: ModalityType.FLUOROSCOPY,
      manufacturer: 'Siemens',
      model: 'Artis zee',
      location: 'Radiology Wing, Room 4',
    },
  ];

  let created = 0;
  for (const mod of modalities) {
    const existing = await modalityRepo.findOne({
      where: { facilityId: facility.id, name: mod.name },
    });
    if (!existing) {
      const modality = modalityRepo.create({
        facilityId: facility.id,
        name: mod.name,
        modalityType: mod.modalityType,
        manufacturer: mod.manufacturer,
        model: mod.model,
        location: mod.location,
        isActive: true,
        isAvailable: true,
      });
      await modalityRepo.save(modality);
      created++;
      console.log(`Created modality: ${mod.name} (${mod.modalityType})`);
    }
  }

  console.log(`\n✅ Seeded ${created} modalities`);
  await dataSource.destroy();
}

seedModalities().catch(console.error);
