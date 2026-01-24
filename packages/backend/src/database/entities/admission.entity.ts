import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { Ward } from './ward.entity';
import { Bed } from './bed.entity';
import { User } from './user.entity';
import { Patient } from './patient.entity';

export enum AdmissionStatus {
  ADMITTED = 'admitted',
  TRANSFERRED = 'transferred',
  DISCHARGED = 'discharged',
  ABSCONDED = 'absconded',
  DECEASED = 'deceased',
}

export enum AdmissionType {
  ELECTIVE = 'elective',
  EMERGENCY = 'emergency',
  TRANSFER = 'transfer',
}

@Entity('admissions')
export class Admission extends BaseEntity {
  @Column({ unique: true })
  admissionNumber: string;

  @Column({ type: 'enum', enum: AdmissionType, default: AdmissionType.EMERGENCY })
  type: AdmissionType;

  @Column({ type: 'enum', enum: AdmissionStatus, default: AdmissionStatus.ADMITTED })
  status: AdmissionStatus;

  @Column({ type: 'timestamp' })
  admissionDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  dischargeDate: Date;

  @Column({ type: 'text', nullable: true })
  admissionReason: string;

  @Column({ type: 'text', nullable: true })
  admissionDiagnosis: string;

  @Column({ type: 'text', nullable: true })
  dischargeSummary: string;

  @Column({ type: 'text', nullable: true })
  dischargeDiagnosis: string;

  @Column({ type: 'text', nullable: true })
  dischargeInstructions: string;

  @Column({ type: 'text', nullable: true })
  followUpPlan: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Relations
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  encounterId: string;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounterId' })
  encounter: Encounter;

  @Column({ type: 'uuid' })
  wardId: string;

  @ManyToOne(() => Ward, ward => ward.admissions)
  @JoinColumn({ name: 'wardId' })
  ward: Ward;

  @Column({ type: 'uuid' })
  bedId: string;

  @ManyToOne(() => Bed, bed => bed.admissions)
  @JoinColumn({ name: 'bedId' })
  bed: Bed;

  @Column({ type: 'uuid' })
  admittedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'admittedById' })
  admittedBy: User;

  @Column({ type: 'uuid', nullable: true })
  dischargedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'dischargedById' })
  dischargedBy: User;

  @Column({ type: 'uuid', nullable: true })
  attendingDoctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'attendingDoctorId' })
  attendingDoctor: User;

  @OneToMany('NursingNote', 'admission')
  nursingNotes: any[];

  @OneToMany('MedicationAdministration', 'admission')
  medicationAdministrations: any[];

  @OneToMany('BedTransfer', 'admission')
  bedTransfers: any[];
}
