import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum DrugSchedule {
  SCHEDULE_I = 'schedule_1',    // No medical use, high abuse (e.g., heroin)
  SCHEDULE_II = 'schedule_2',   // High abuse, severe dependence (e.g., morphine)
  SCHEDULE_III = 'schedule_3',  // Moderate abuse potential (e.g., codeine)
  SCHEDULE_IV = 'schedule_4',   // Low abuse potential (e.g., diazepam)
  SCHEDULE_V = 'schedule_5',    // Lowest abuse potential
  OTC = 'otc',                  // Over the counter
  POM = 'pom',                  // Prescription only medicine
  UNSCHEDULED = 'unscheduled',
}

export enum DrugStorageCondition {
  ROOM_TEMPERATURE = 'room_temperature',      // 15-25°C
  REFRIGERATED = 'refrigerated',              // 2-8°C
  FROZEN = 'frozen',                          // -20°C or below
  CONTROLLED_ROOM = 'controlled_room',        // 20-25°C
  COOL = 'cool',                              // 8-15°C
  PROTECT_FROM_LIGHT = 'protect_from_light',
  DRY = 'dry',
}

export enum TherapeuticClass {
  ANALGESICS = 'analgesics',
  ANTIBIOTICS = 'antibiotics',
  ANTIVIRALS = 'antivirals',
  ANTIFUNGALS = 'antifungals',
  ANTIMALARIALS = 'antimalarials',
  ANTIRETROVIRALS = 'antiretrovirals',
  ANTITUBERCULOSIS = 'antituberculosis',
  ANTIHYPERTENSIVES = 'antihypertensives',
  ANTIDIABETICS = 'antidiabetics',
  ANTICOAGULANTS = 'anticoagulants',
  CARDIOVASCULAR = 'cardiovascular',
  CNS_AGENTS = 'cns_agents',
  GASTROINTESTINAL = 'gastrointestinal',
  RESPIRATORY = 'respiratory',
  DERMATOLOGICAL = 'dermatological',
  HORMONES = 'hormones',
  IMMUNOSUPPRESSANTS = 'immunosuppressants',
  VACCINES = 'vaccines',
  VITAMINS = 'vitamins',
  MINERALS = 'minerals',
  FLUIDS_ELECTROLYTES = 'fluids_electrolytes',
  ANAESTHETICS = 'anaesthetics',
  ANTIDOTES = 'antidotes',
  ONCOLOGY = 'oncology',
  OPHTHALMOLOGY = 'ophthalmology',
  OTHER = 'other',
}

export enum DrugFormulation {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  SUSPENSION = 'suspension',
  INJECTION = 'injection',
  INFUSION = 'infusion',
  CREAM = 'cream',
  OINTMENT = 'ointment',
  GEL = 'gel',
  DROPS = 'drops',
  INHALER = 'inhaler',
  SUPPOSITORY = 'suppository',
  PATCH = 'patch',
  POWDER = 'powder',
  SOLUTION = 'solution',
  LOTION = 'lotion',
  SPRAY = 'spray',
  OTHER = 'other',
}

@Entity('drug_classifications')
@Index(['itemId'], { unique: true, where: 'deleted_at IS NULL' })
export class DrugClassification extends BaseEntity {
  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'atc_code' })
  atcCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'atc_description' })
  atcDescription?: string;

  @Column({
    type: 'enum',
    enum: DrugSchedule,
    default: DrugSchedule.UNSCHEDULED,
  })
  schedule: DrugSchedule;

  @Column({
    type: 'enum',
    enum: TherapeuticClass,
    nullable: true,
    name: 'therapeutic_class',
  })
  therapeuticClass?: TherapeuticClass;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'therapeutic_subclass' })
  therapeuticSubclass?: string;

  @Column({
    type: 'enum',
    enum: DrugFormulation,
    nullable: true,
  })
  formulation?: DrugFormulation;

  @Column({ type: 'varchar', length: 100, nullable: true })
  strength?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'generic_name' })
  genericName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'brand_name' })
  brandName?: string;

  @Column({ type: 'boolean', default: false, name: 'is_controlled' })
  isControlled: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_narcotic' })
  isNarcotic: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_psychotropic' })
  isPsychotropic: boolean;

  @Column({ type: 'boolean', default: false, name: 'requires_double_check' })
  requiresDoubleCheck: boolean;

  @Column({ type: 'boolean', default: false, name: 'high_alert' })
  highAlert: boolean;

  @Column({ type: 'boolean', default: false, name: 'look_alike_sound_alike' })
  lookAlikeSoundAlike: boolean;

  @Column({
    type: 'enum',
    enum: DrugStorageCondition,
    default: DrugStorageCondition.ROOM_TEMPERATURE,
    name: 'storage_condition',
  })
  storageCondition: DrugStorageCondition;

  @Column({ type: 'int', nullable: true, name: 'max_single_dose' })
  maxSingleDose?: number;

  @Column({ type: 'int', nullable: true, name: 'max_daily_dose' })
  maxDailyDose?: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'dose_unit' })
  doseUnit?: string;

  @Column({ type: 'text', nullable: true })
  contraindications?: string;

  @Column({ type: 'text', nullable: true })
  warnings?: string;

  @Column({ type: 'text', nullable: true, name: 'pregnancy_category' })
  pregnancyCategory?: string;

  @Column({ type: 'boolean', default: true, name: 'is_on_formulary' })
  isOnFormulary: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'formulary_tier' })
  formularyTier?: string;

  @Column({ type: 'boolean', default: false, name: 'requires_prior_auth' })
  requiresPriorAuth: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}

@Entity('drug_interactions')
@Index(['drugAId', 'drugBId'], { unique: true, where: 'deleted_at IS NULL' })
export class DrugInteraction extends BaseEntity {
  @Column({ type: 'uuid', name: 'drug_a_id' })
  drugAId: string;

  @Column({ type: 'uuid', name: 'drug_b_id' })
  drugBId: string;

  @Column({ type: 'varchar', length: 20 })
  severity: string; // minor, moderate, major, contraindicated

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true, name: 'clinical_effects' })
  clinicalEffects?: string;

  @Column({ type: 'text', nullable: true })
  mechanism?: string;

  @Column({ type: 'text', nullable: true })
  management?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}

@Entity('drug_allergy_classes')
export class DrugAllergyClass extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'class_name' })
  className: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'related_drugs' })
  relatedDrugs?: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'cross_reactive_classes' })
  crossReactiveClasses?: string[];
}

// Common Uganda Essential Medicines List classifications
export const UGANDA_ESSENTIAL_MEDICINES = [
  { genericName: 'Artemether-Lumefantrine', atcCode: 'P01BF01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIMALARIALS },
  { genericName: 'Amoxicillin', atcCode: 'J01CA04', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIBIOTICS },
  { genericName: 'Metformin', atcCode: 'A10BA02', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIDIABETICS },
  { genericName: 'Amlodipine', atcCode: 'C08CA01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIHYPERTENSIVES },
  { genericName: 'Omeprazole', atcCode: 'A02BC01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.GASTROINTESTINAL },
  { genericName: 'Paracetamol', atcCode: 'N02BE01', schedule: DrugSchedule.OTC, therapeuticClass: TherapeuticClass.ANALGESICS },
  { genericName: 'Ibuprofen', atcCode: 'M01AE01', schedule: DrugSchedule.OTC, therapeuticClass: TherapeuticClass.ANALGESICS },
  { genericName: 'Morphine', atcCode: 'N02AA01', schedule: DrugSchedule.SCHEDULE_II, therapeuticClass: TherapeuticClass.ANALGESICS, isControlled: true, isNarcotic: true },
  { genericName: 'Diazepam', atcCode: 'N05BA01', schedule: DrugSchedule.SCHEDULE_IV, therapeuticClass: TherapeuticClass.CNS_AGENTS, isControlled: true, isPsychotropic: true },
  { genericName: 'Cotrimoxazole', atcCode: 'J01EE01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIBIOTICS },
  { genericName: 'Tenofovir/Lamivudine/Dolutegravir', atcCode: 'J05AR25', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIRETROVIRALS },
  { genericName: 'Rifampicin/Isoniazid/Pyrazinamide/Ethambutol', atcCode: 'J04AM06', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTITUBERCULOSIS },
  { genericName: 'Oxytocin', atcCode: 'H01BB02', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.HORMONES, highAlert: true },
  { genericName: 'Insulin (Regular)', atcCode: 'A10AB01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTIDIABETICS, highAlert: true, storageCondition: DrugStorageCondition.REFRIGERATED },
  { genericName: 'Heparin', atcCode: 'B01AB01', schedule: DrugSchedule.POM, therapeuticClass: TherapeuticClass.ANTICOAGULANTS, highAlert: true },
  { genericName: 'Ketamine', atcCode: 'N01AX03', schedule: DrugSchedule.SCHEDULE_III, therapeuticClass: TherapeuticClass.ANAESTHETICS, isControlled: true },
  { genericName: 'Pethidine', atcCode: 'N02AB02', schedule: DrugSchedule.SCHEDULE_II, therapeuticClass: TherapeuticClass.ANALGESICS, isControlled: true, isNarcotic: true },
  { genericName: 'ORS (Oral Rehydration Salts)', atcCode: 'A07CA', schedule: DrugSchedule.OTC, therapeuticClass: TherapeuticClass.FLUIDS_ELECTROLYTES },
  { genericName: 'Zinc Sulfate', atcCode: 'A12CB01', schedule: DrugSchedule.OTC, therapeuticClass: TherapeuticClass.MINERALS },
  { genericName: 'Vitamin A', atcCode: 'A11CA01', schedule: DrugSchedule.OTC, therapeuticClass: TherapeuticClass.VITAMINS },
];
