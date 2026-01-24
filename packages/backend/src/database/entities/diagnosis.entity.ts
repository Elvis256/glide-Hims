import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum DiagnosisCategory {
  INFECTIOUS = 'infectious',
  NEOPLASMS = 'neoplasms',
  BLOOD = 'blood',
  ENDOCRINE = 'endocrine',
  MENTAL = 'mental',
  NERVOUS = 'nervous',
  EYE = 'eye',
  EAR = 'ear',
  CIRCULATORY = 'circulatory',
  RESPIRATORY = 'respiratory',
  DIGESTIVE = 'digestive',
  SKIN = 'skin',
  MUSCULOSKELETAL = 'musculoskeletal',
  GENITOURINARY = 'genitourinary',
  PREGNANCY = 'pregnancy',
  PERINATAL = 'perinatal',
  CONGENITAL = 'congenital',
  SYMPTOMS = 'symptoms',
  INJURY = 'injury',
  EXTERNAL = 'external',
  OTHER = 'other',
}

@Entity('diagnoses')
@Index(['icd10Code'], { unique: true, where: 'deleted_at IS NULL' })
export class Diagnosis extends BaseEntity {
  @Column({ type: 'varchar', length: 20, name: 'icd10_code' })
  icd10Code: string;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'short_name' })
  shortName?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: DiagnosisCategory,
    default: DiagnosisCategory.OTHER,
  })
  category: DiagnosisCategory;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'chapter_code' })
  chapterCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'chapter_name' })
  chapterName?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'block_code' })
  blockCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'block_name' })
  blockName?: string;

  @Column({ type: 'boolean', default: false, name: 'is_notifiable' })
  isNotifiable: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_chronic' })
  isChronic: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'synonyms' })
  synonyms?: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'related_codes' })
  relatedCodes?: string[];
}

// Common Uganda diagnoses for seeding
export const COMMON_DIAGNOSES = [
  { icd10Code: 'A09', name: 'Infectious gastroenteritis and colitis', category: DiagnosisCategory.INFECTIOUS },
  { icd10Code: 'A15', name: 'Respiratory tuberculosis', category: DiagnosisCategory.INFECTIOUS, isNotifiable: true },
  { icd10Code: 'B20', name: 'HIV disease', category: DiagnosisCategory.INFECTIOUS, isChronic: true },
  { icd10Code: 'B50', name: 'Plasmodium falciparum malaria', category: DiagnosisCategory.INFECTIOUS, isNotifiable: true },
  { icd10Code: 'B54', name: 'Unspecified malaria', category: DiagnosisCategory.INFECTIOUS, isNotifiable: true },
  { icd10Code: 'E10', name: 'Type 1 diabetes mellitus', category: DiagnosisCategory.ENDOCRINE, isChronic: true },
  { icd10Code: 'E11', name: 'Type 2 diabetes mellitus', category: DiagnosisCategory.ENDOCRINE, isChronic: true },
  { icd10Code: 'I10', name: 'Essential (primary) hypertension', category: DiagnosisCategory.CIRCULATORY, isChronic: true },
  { icd10Code: 'J00', name: 'Acute nasopharyngitis (common cold)', category: DiagnosisCategory.RESPIRATORY },
  { icd10Code: 'J06', name: 'Acute upper respiratory infection', category: DiagnosisCategory.RESPIRATORY },
  { icd10Code: 'J18', name: 'Pneumonia', category: DiagnosisCategory.RESPIRATORY },
  { icd10Code: 'J45', name: 'Asthma', category: DiagnosisCategory.RESPIRATORY, isChronic: true },
  { icd10Code: 'K29', name: 'Gastritis and duodenitis', category: DiagnosisCategory.DIGESTIVE },
  { icd10Code: 'K52', name: 'Non-infective gastroenteritis and colitis', category: DiagnosisCategory.DIGESTIVE },
  { icd10Code: 'L02', name: 'Cutaneous abscess, furuncle and carbuncle', category: DiagnosisCategory.SKIN },
  { icd10Code: 'M54', name: 'Dorsalgia (back pain)', category: DiagnosisCategory.MUSCULOSKELETAL },
  { icd10Code: 'N39', name: 'Urinary tract infection', category: DiagnosisCategory.GENITOURINARY },
  { icd10Code: 'O80', name: 'Single spontaneous delivery', category: DiagnosisCategory.PREGNANCY },
  { icd10Code: 'O82', name: 'Delivery by caesarean section', category: DiagnosisCategory.PREGNANCY },
  { icd10Code: 'R50', name: 'Fever of unknown origin', category: DiagnosisCategory.SYMPTOMS },
  { icd10Code: 'R51', name: 'Headache', category: DiagnosisCategory.SYMPTOMS },
  { icd10Code: 'R10', name: 'Abdominal and pelvic pain', category: DiagnosisCategory.SYMPTOMS },
  { icd10Code: 'S00', name: 'Superficial injury of head', category: DiagnosisCategory.INJURY },
  { icd10Code: 'T14', name: 'Injury of unspecified body region', category: DiagnosisCategory.INJURY },
  { icd10Code: 'Z00', name: 'General examination', category: DiagnosisCategory.OTHER },
];
