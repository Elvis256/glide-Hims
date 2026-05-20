import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import {
  DrugSchedule,
  TherapeuticClass,
  DrugFormulation,
  DrugStorageCondition,
} from '../../database/entities/drug-classification.entity';

const NUMBER_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class CreateDrugClassificationDto {
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  atcCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  atcDescription?: string;

  @IsOptional()
  @IsEnum(DrugSchedule)
  schedule?: DrugSchedule;

  @IsOptional()
  @IsEnum(TherapeuticClass)
  therapeuticClass?: TherapeuticClass;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  therapeuticSubclass?: string;

  @IsOptional()
  @IsEnum(DrugFormulation)
  formulation?: DrugFormulation;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  strength?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  genericName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  brandName?: string;

  @IsBoolean()
  @IsOptional()
  isControlled?: boolean;

  @IsBoolean()
  @IsOptional()
  isNarcotic?: boolean;

  @IsBoolean()
  @IsOptional()
  isPsychotropic?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresDoubleCheck?: boolean;

  @IsBoolean()
  @IsOptional()
  highAlert?: boolean;

  @IsBoolean()
  @IsOptional()
  lookAlikeSoundAlike?: boolean;

  @IsOptional()
  @IsEnum(DrugStorageCondition)
  storageCondition?: DrugStorageCondition;

  @IsOptional()
  @IsNumber(NUMBER_OPTS)
  @Min(0.001)
  @Max(50000)
  maxSingleDose?: number;

  @IsOptional()
  @IsNumber(NUMBER_OPTS)
  @Min(0.001)
  @Max(100000)
  maxDailyDose?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  doseUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  contraindications?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  warnings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pregnancyCategory?: string;

  @IsOptional()
  @IsBoolean()
  isOnFormulary?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  formularyTier?: string;

  @IsOptional()
  @IsBoolean()
  requiresPriorAuth?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateDrugClassificationDto extends CreateDrugClassificationDto {
  @IsOptional()
  @IsUUID()
  declare itemId: string;
}

export class CreateDrugInteractionDto {
  @IsUUID()
  drugAId: string;

  @IsUUID()
  drugBId: string;

  @IsString()
  @MaxLength(32)
  severity: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalEffects?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mechanism?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  management?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;
}

export class UpdateDrugInteractionDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalEffects?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mechanism?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  management?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CheckInteractionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  drugIds: string[];
}

export class CreateAllergyClassDto {
  @IsString()
  @MaxLength(128)
  className: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  relatedDrugs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  crossReactiveClasses?: string[];
}

export class CheckAllergyRiskDto {
  @IsUUID()
  drugId: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  patientAllergies: string[];
}
