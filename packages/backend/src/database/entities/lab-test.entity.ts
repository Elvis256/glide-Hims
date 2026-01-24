import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum LabTestCategory {
  HEMATOLOGY = 'hematology',
  CHEMISTRY = 'chemistry',
  MICROBIOLOGY = 'microbiology',
  SEROLOGY = 'serology',
  URINALYSIS = 'urinalysis',
  PARASITOLOGY = 'parasitology',
  IMMUNOLOGY = 'immunology',
  MOLECULAR = 'molecular',
  BLOOD_BANK = 'blood_bank',
  OTHER = 'other',
}

export enum LabTestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum SampleType {
  BLOOD = 'blood',
  SERUM = 'serum',
  PLASMA = 'plasma',
  URINE = 'urine',
  STOOL = 'stool',
  SPUTUM = 'sputum',
  CSF = 'csf',
  SWAB = 'swab',
  TISSUE = 'tissue',
  OTHER = 'other',
}

@Entity('lab_tests')
export class LabTest extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: LabTestCategory, default: LabTestCategory.OTHER })
  category: LabTestCategory;

  @Column({ type: 'enum', enum: SampleType, default: SampleType.BLOOD })
  sampleType: SampleType;

  @Column({ type: 'enum', enum: LabTestStatus, default: LabTestStatus.ACTIVE })
  status: LabTestStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'int', default: 60 })
  turnaroundTimeMinutes: number;

  @Column({ type: 'jsonb', nullable: true })
  referenceRanges: {
    parameter: string;
    unit: string;
    normalMin?: number;
    normalMax?: number;
    criticalLow?: number;
    criticalHigh?: number;
    textNormal?: string;
    ageGroup?: string;
    gender?: 'male' | 'female' | 'all';
  }[];

  @Column({ type: 'jsonb', nullable: true })
  components: string[];

  @Column({ type: 'boolean', default: false })
  requiresFasting: boolean;

  @Column({ type: 'text', nullable: true })
  specialInstructions: string;

  @OneToMany('LabSample', 'labTest')
  samples: any[];
}
