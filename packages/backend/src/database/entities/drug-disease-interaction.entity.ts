import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum DrugDiseaseSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CONTRAINDICATED = 'contraindicated',
}

@Entity('drug_disease_interactions')
@Index(['icd10Code', 'isActive'])
export class DrugDiseaseInteraction extends BaseEntity {
  @Column({ name: 'drug_classification_id', type: 'uuid', nullable: true })
  drugClassificationId: string | null;

  @Column({ name: 'drug_id', type: 'uuid', nullable: true })
  drugId: string | null;

  @Column({ type: 'varchar', length: 20, name: 'atc_code', nullable: true })
  atcCode: string | null;

  @Column({ type: 'varchar', length: 20, name: 'icd10_code' })
  icd10Code: string;

  @Column({
    type: 'enum',
    enum: DrugDiseaseSeverity,
    default: DrugDiseaseSeverity.MODERATE,
  })
  severity: DrugDiseaseSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'clinical_effects', type: 'text', nullable: true })
  clinicalEffects: string | null;

  @Column({ type: 'text', nullable: true })
  recommendation: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
