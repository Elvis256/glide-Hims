import { DataSource } from 'typeorm';
import { Theatre, TheatreType, TheatreStatus } from '../entities/theatre.entity';

const theatres: Array<{
  name: string;
  code: string;
  type: TheatreType;
  location: string;
  equipment: { name: string; status: 'working' | 'maintenance' | 'broken' }[];
}> = [
  {
    name: 'Main Operating Theatre 1',
    code: 'OT-01',
    type: TheatreType.GENERAL,
    location: 'Surgical Block, 2nd Floor',
    equipment: [
      { name: 'Anesthesia Machine', status: 'working' },
      { name: 'Surgical Lights', status: 'working' },
      { name: 'Patient Monitor', status: 'working' },
      { name: 'Electrosurgical Unit', status: 'working' },
    ],
  },
  {
    name: 'Main Operating Theatre 2',
    code: 'OT-02',
    type: TheatreType.GENERAL,
    location: 'Surgical Block, 2nd Floor',
    equipment: [
      { name: 'Anesthesia Machine', status: 'working' },
      { name: 'Surgical Lights', status: 'working' },
      { name: 'Patient Monitor', status: 'working' },
      { name: 'Laparoscopic Tower', status: 'working' },
    ],
  },
  {
    name: 'Orthopedic Theatre',
    code: 'OT-ORTHO',
    type: TheatreType.ORTHOPEDIC,
    location: 'Surgical Block, 2nd Floor',
    equipment: [
      { name: 'C-Arm Fluoroscopy', status: 'working' },
      { name: 'Orthopedic Power Tools', status: 'working' },
      { name: 'Traction Table', status: 'working' },
      { name: 'Patient Monitor', status: 'working' },
    ],
  },
  {
    name: 'Obstetric Theatre',
    code: 'OT-OBS',
    type: TheatreType.OBSTETRIC,
    location: 'Maternity Block, 1st Floor',
    equipment: [
      { name: 'Fetal Monitor', status: 'working' },
      { name: 'Neonatal Resuscitation Unit', status: 'working' },
      { name: 'Anesthesia Machine', status: 'working' },
      { name: 'Vacuum Extractor', status: 'working' },
    ],
  },
  {
    name: 'Minor Theatre',
    code: 'OT-MINOR',
    type: TheatreType.MINOR,
    location: 'Outpatient Block, Ground Floor',
    equipment: [
      { name: 'Minor Surgery Set', status: 'working' },
      { name: 'Local Anesthesia Kit', status: 'working' },
      { name: 'Surgical Lights', status: 'working' },
    ],
  },
  {
    name: 'Eye Theatre',
    code: 'OT-EYE',
    type: TheatreType.OPHTHALMIC,
    location: 'Eye Clinic, 1st Floor',
    equipment: [
      { name: 'Operating Microscope', status: 'working' },
      { name: 'Phacoemulsification Machine', status: 'working' },
      { name: 'Vitrectomy System', status: 'maintenance' },
    ],
  },
];

async function seed() {
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
  console.log('Connected to database');

  const theatreRepo = dataSource.getRepository(Theatre);

  // Get first facility
  const facility = await dataSource.query('SELECT id FROM facilities LIMIT 1');
  if (!facility.length) {
    console.error('No facility found. Run main seeds first.');
    await dataSource.destroy();
    process.exit(1);
  }

  const facilityId = facility[0].id;
  console.log(`Using facility: ${facilityId}`);

  // Check existing theatres
  const existing = await theatreRepo.count();
  if (existing > 0) {
    console.log(`Already have ${existing} theatres, skipping seed.`);
    await dataSource.destroy();
    return;
  }

  // Create theatres
  for (const t of theatres) {
    const theatre = theatreRepo.create({
      ...t,
      facilityId,
      status: TheatreStatus.AVAILABLE,
      isActive: true,
    });
    await theatreRepo.save(theatre);
    console.log(`Created theatre: ${t.name} (${t.code})`);
  }

  console.log(`\n✓ Seeded ${theatres.length} theatres`);
  await dataSource.destroy();
}

seed().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
});
