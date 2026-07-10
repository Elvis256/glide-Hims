import {
  IsUUID,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import {
  ESILevel,
  TriageAcuityColor,
  TriageDisposition,
  MobilityStatus,
  MentalStatus,
} from '../../../database/entities/triage-assessment.entity';
import { ConsciousnessLevel } from '../../../database/entities/vital.entity';

export class CreateTriageAssessmentDto {
  @IsUUID()
  queueId: string;

  @IsString()
  @MaxLength(2000)
  chiefComplaint: string;

  @IsOptional()
  @IsString()
  onset?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsEnum(ESILevel)
  esiLevel?: ESILevel;

  @IsOptional()
  @IsEnum(TriageAcuityColor)
  acuityColor?: TriageAcuityColor;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  painScore?: number;

  @IsOptional()
  @IsString()
  painLocation?: string;

  @IsOptional()
  @IsString()
  painCharacter?: string;

  @IsOptional()
  @IsEnum(MobilityStatus)
  mobilityStatus?: MobilityStatus;

  @IsOptional()
  @IsEnum(MentalStatus)
  mentalStatus?: MentalStatus;

  @IsOptional()
  @IsEnum(ConsciousnessLevel)
  consciousnessLevel?: ConsciousnessLevel;

  @IsOptional()
  @IsBoolean()
  supplementalOxygen?: boolean;

  // Vital signs
  @IsOptional()
  @IsNumber()
  @Min(32)
  @Max(45)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(250)
  pulse?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(300)
  bpSystolic?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(200)
  bpDiastolic?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1500)
  bloodGlucose?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(500)
  weight?: number;

  @IsOptional()
  @IsEnum(TriageDisposition)
  disposition?: TriageDisposition;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  nursingNotes?: string;
}
