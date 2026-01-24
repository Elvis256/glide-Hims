import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AntenatalRegistration } from './antenatal-registration.entity';
import { User } from './user.entity';

@Entity('antenatal_visits')
export class AntenatalVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'registration_id' })
  registrationId: string;

  @ManyToOne(() => AntenatalRegistration)
  @JoinColumn({ name: 'registration_id' })
  registration: AntenatalRegistration;

  @Column({ type: 'int', name: 'visit_number' })
  visitNumber: number;

  @Column({ type: 'date', name: 'visit_date' })
  visitDate: Date;

  @Column({ type: 'int', name: 'gestational_age' })
  gestationalAge: number; // weeks

  // Vitals
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number;

  @Column({ type: 'int', nullable: true, name: 'bp_systolic' })
  bpSystolic: number;

  @Column({ type: 'int', nullable: true, name: 'bp_diastolic' })
  bpDiastolic: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ type: 'int', nullable: true, name: 'pulse_rate' })
  pulseRate: number;

  // Obstetric examination
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'fundal_height' })
  fundalHeight: number; // cm

  @Column({ length: 50, nullable: true, name: 'fetal_presentation' })
  fetalPresentation: string; // cephalic, breech, transverse

  @Column({ type: 'int', nullable: true, name: 'fetal_heart_rate' })
  fetalHeartRate: number;

  @Column({ type: 'boolean', nullable: true, name: 'fetal_movement' })
  fetalMovement: boolean;

  @Column({ type: 'boolean', nullable: true })
  edema: boolean;

  // Lab results summary
  @Column({ type: 'boolean', nullable: true, name: 'urine_protein' })
  urineProtein: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'urine_glucose' })
  urineGlucose: boolean;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  hemoglobin: number;

  // Interventions
  @Column({ type: 'boolean', default: false, name: 'iron_folate_given' })
  ironFolateGiven: boolean;

  @Column({ type: 'boolean', default: false, name: 'tetanus_toxoid_given' })
  tetanusToxoidGiven: boolean;

  @Column({ type: 'int', nullable: true, name: 'tt_dose_number' })
  ttDoseNumber: number;

  @Column({ type: 'boolean', default: false, name: 'ipt_given' })
  iptGiven: boolean; // Intermittent preventive treatment (malaria)

  @Column({ type: 'int', nullable: true, name: 'ipt_dose_number' })
  iptDoseNumber: number;

  @Column({ type: 'boolean', default: false, name: 'deworming_given' })
  dewormingGiven: boolean;

  // Assessment
  @Column({ type: 'text', nullable: true })
  complaints: string;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ type: 'text', nullable: true })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  @Column({ type: 'date', nullable: true, name: 'next_visit_date' })
  nextVisitDate: Date;

  // Provider
  @Column({ type: 'uuid', nullable: true, name: 'seen_by_id' })
  seenById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seen_by_id' })
  seenBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
