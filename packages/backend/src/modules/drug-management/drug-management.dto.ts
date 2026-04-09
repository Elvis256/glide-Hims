import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID, IsArray, IsNumber, Min, Max } from 'class-validator';
import { DrugSchedule, TherapeuticClass, DrugFormulation, DrugStorageCondition } from '../../database/entities/drug-classification.entity';

export class CreateDrugClassificationDto {
  @IsUUID()
  itemId: string;

  @IsOptional() @IsString()
  atcCode?: string;

  @IsOptional() @IsString()
  atcDescription?: string;

  @IsOptional() @IsEnum(DrugSchedule)
  schedule?: DrugSchedule;

  @IsOptional() @IsEnum(TherapeuticClass)
  therapeuticClass?: TherapeuticClass;

  @IsOptional() @IsString()
  therapeuticSubclass?: string;

  @IsOptional() @IsEnum(DrugFormulation)
  formulation?: DrugFormulation;

  @IsOptional() @IsString()
  strength?: string;

  @IsOptional() @IsString()
  genericName?: string;

  @IsOptional() @IsString()
  brandName?: string;

  @IsBoolean() @IsOptional()
  isControlled?: boolean;

  @IsBoolean() @IsOptional()
  isNarcotic?: boolean;

  @IsBoolean() @IsOptional()
  isPsychotropic?: boolean;

  @IsBoolean() @IsOptional()
  requiresDoubleCheck?: boolean;

  @IsBoolean() @IsOptional()
  highAlert?: boolean;

  @IsBoolean() @IsOptional()
  lookAlikeSoundAlike?: boolean;

  @IsOptional() @IsEnum(DrugStorageCondition)
  storageCondition?: DrugStorageCondition;

  @IsOptional() @IsNumber() @Min(0.001) @Max(50000)
  maxSingleDose?: number;

  @IsOptional() @IsNumber() @Min(0.001) @Max(100000)
  maxDailyDose?: number;

  @IsOptional() @IsString()
  doseUnit?: string;

  @IsOptional() @IsString()
  contraindications?: string;

  @IsOptional() @IsString()
  warnings?: string;

  @IsOptional() @IsString()
  pregnancyCategory?: string;

  @IsOptional() @IsBoolean()
  isOnFormulary?: boolean;

  @IsOptional() @IsString()
  formularyTier?: string;

  @IsOptional() @IsBoolean()
  requiresPriorAuth?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateDrugClassificationDto extends CreateDrugClassificationDto {
  @IsOptional() @IsUUID()
  declare itemId: string;
}

export class CreateDrugInteractionDto {
  @IsUUID()
  drugAId: string;

  @IsUUID()
  drugBId: string;

  @IsString()
  severity: string;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  clinicalEffects?: string;

  @IsOptional() @IsString()
  mechanism?: string;

  @IsOptional() @IsString()
  management?: string;

  @IsOptional() @IsString()
  reference?: string;
}

export class UpdateDrugInteractionDto {
  @IsOptional() @IsString()
  severity?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  clinicalEffects?: string;

  @IsOptional() @IsString()
  mechanism?: string;

  @IsOptional() @IsString()
  management?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CheckInteractionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  drugIds: string[];
}

export class CreateAllergyClassDto {
  @IsString()
  className: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  relatedDrugs?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  crossReactiveClasses?: string[];
}

export class CheckAllergyRiskDto {
  @IsUUID()
  drugId: string;

  @IsArray()
  @IsString({ each: true })
  patientAllergies: string[];
}
