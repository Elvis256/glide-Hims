import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { DeliveryOutcome } from './delivery-outcome.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum VaccineName {
  BCG = 'BCG',
  OPV_0 = 'OPV-0',
  OPV_1 = 'OPV-1',
  OPV_2 = 'OPV-2',
  OPV_3 = 'OPV-3',
  DPT_HEPB_HIB_1 = 'DPT-HepB-Hib-1',
  DPT_HEPB_HIB_2 = 'DPT-HepB-Hib-2',
  DPT_HEPB_HIB_3 = 'DPT-HepB-Hib-3',
  PCV_1 = 'PCV-1',
  PCV_2 = 'PCV-2',
  PCV_3 = 'PCV-3',
  ROTA_1 = 'Rota-1',
  ROTA_2 = 'Rota-2',
  IPV = 'IPV',
  MEASLES_1 = 'Measles-1',
  MEASLES_2 = 'Measles-2',
  VITAMIN_A_1 = 'Vitamin-A-1',
  VITAMIN_A_2 = 'Vitamin-A-2',
  VITAMIN_A_3 = 'Vitamin-A-3',
  VITAMIN_A_4 = 'Vitamin-A-4',
  TETANUS_1 = 'TT-1',
  TETANUS_2 = 'TT-2',
  TETANUS_3 = 'TT-3',
  TETANUS_4 = 'TT-4',
  TETANUS_5 = 'TT-5',
  HPV_1 = 'HPV-1',
  HPV_2 = 'HPV-2',
  COVID_1 = 'COVID-1',
  COVID_2 = 'COVID-2',
  COVID_BOOSTER = 'COVID-Booster',
}

export enum ImmunizationStatus {
  SCHEDULED = 'scheduled',
  DUE = 'due',
  OVERDUE = 'overdue',
  ADMINISTERED = 'administered',
  MISSED = 'missed',
  CONTRAINDICATED = 'contraindicated',
}

export enum AdverseReactionSeverity {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

@Entity('immunization_schedules')
export class ImmunizationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Can link to either patient (adult vaccines) or baby (from delivery)
  @Column({ type: 'uuid', name: 'patient_id', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'delivery_outcome_id', nullable: true })
  deliveryOutcomeId: string;

  @ManyToOne(() => DeliveryOutcome)
  @JoinColumn({ name: 'delivery_outcome_id' })
  deliveryOutcome: DeliveryOutcome;

  // Vaccine Info
  @Column({ type: 'enum', enum: VaccineName, name: 'vaccine_name' })
  vaccineName: VaccineName;

  @Column({ type: 'int', name: 'dose_number' })
  doseNumber: number;

  @Column({ type: 'int', name: 'age_in_weeks_due' })
  ageInWeeksDue: number; // Standard age for this vaccine

  // Schedule
  @Column({ type: 'date', name: 'scheduled_date' })
  scheduledDate: Date;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: Date;

  @Column({ type: 'date', nullable: true, name: 'grace_period_end' })
  gracePeriodEnd: Date; // After this, marked overdue

  // Administration
  @Column({ type: 'enum', enum: ImmunizationStatus, default: ImmunizationStatus.SCHEDULED })
  status: ImmunizationStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'administered_at' })
  administeredAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'administered_by_id' })
  administeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'administered_by_id' })
  administeredBy: User;

  // Vaccine Details
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'batch_number' })
  batchNumber: string;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'site_of_administration' })
  siteOfAdministration: string; // Left arm, right thigh, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  route: string; // IM, SC, Oral

  // Adverse Events
  @Column({ type: 'boolean', default: false, name: 'adverse_reaction' })
  adverseReaction: boolean;

  @Column({ type: 'enum', enum: AdverseReactionSeverity, default: AdverseReactionSeverity.NONE, name: 'reaction_severity' })
  reactionSeverity: AdverseReactionSeverity;

  @Column({ type: 'text', nullable: true, name: 'reaction_description' })
  reactionDescription: string;

  @Column({ type: 'text', nullable: true, name: 'reaction_treatment' })
  reactionTreatment: string;

  // Contraindication
  @Column({ type: 'text', nullable: true, name: 'contraindication_reason' })
  contraindicationReason: string;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Standard Uganda EPI Schedule Template
export const UGANDA_EPI_SCHEDULE = [
  { vaccine: VaccineName.BCG, doseNumber: 1, ageWeeks: 0 },
  { vaccine: VaccineName.OPV_0, doseNumber: 0, ageWeeks: 0 },
  { vaccine: VaccineName.OPV_1, doseNumber: 1, ageWeeks: 6 },
  { vaccine: VaccineName.DPT_HEPB_HIB_1, doseNumber: 1, ageWeeks: 6 },
  { vaccine: VaccineName.PCV_1, doseNumber: 1, ageWeeks: 6 },
  { vaccine: VaccineName.ROTA_1, doseNumber: 1, ageWeeks: 6 },
  { vaccine: VaccineName.OPV_2, doseNumber: 2, ageWeeks: 10 },
  { vaccine: VaccineName.DPT_HEPB_HIB_2, doseNumber: 2, ageWeeks: 10 },
  { vaccine: VaccineName.PCV_2, doseNumber: 2, ageWeeks: 10 },
  { vaccine: VaccineName.ROTA_2, doseNumber: 2, ageWeeks: 10 },
  { vaccine: VaccineName.OPV_3, doseNumber: 3, ageWeeks: 14 },
  { vaccine: VaccineName.DPT_HEPB_HIB_3, doseNumber: 3, ageWeeks: 14 },
  { vaccine: VaccineName.PCV_3, doseNumber: 3, ageWeeks: 14 },
  { vaccine: VaccineName.IPV, doseNumber: 1, ageWeeks: 14 },
  { vaccine: VaccineName.MEASLES_1, doseNumber: 1, ageWeeks: 39 }, // 9 months
  { vaccine: VaccineName.VITAMIN_A_1, doseNumber: 1, ageWeeks: 26 }, // 6 months
  { vaccine: VaccineName.VITAMIN_A_2, doseNumber: 2, ageWeeks: 52 }, // 12 months
  { vaccine: VaccineName.MEASLES_2, doseNumber: 2, ageWeeks: 78 }, // 18 months
];
