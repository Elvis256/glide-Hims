import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsArray,
  IsDateString,
  IsInt,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============ TOOTH RECORD ============

export class SurfaceConditionDto {
  @ApiProperty({ enum: ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'] })
  @IsString()
  surface: string;

  @ApiProperty()
  @IsString()
  condition: string;

  @ApiProperty()
  @IsString()
  severity: string;
}

export class CreateToothRecordDto {
  @ApiProperty({ example: '14' })
  @IsString()
  @MaxLength(5)
  toothNumber: string;

  @ApiPropertyOptional({ enum: ['universal', 'palmer', 'fdi'], default: 'universal' })
  @IsOptional()
  @IsString()
  toothSystem?: string;

  @ApiPropertyOptional({
    enum: [
      'healthy', 'decayed', 'filled', 'missing', 'crowned', 'implant',
      'root_canal', 'bridge_abutment', 'bridge_pontic', 'veneer',
      'sealant', 'impacted', 'unerupted',
    ],
    default: 'healthy',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [SurfaceConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurfaceConditionDto)
  conditions?: SurfaceConditionDto[];

  @ApiPropertyOptional({ minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  mobility?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateToothRecordDto {
  @ApiPropertyOptional({
    enum: [
      'healthy', 'decayed', 'filled', 'missing', 'crowned', 'implant',
      'root_canal', 'bridge_abutment', 'bridge_pontic', 'veneer',
      'sealant', 'impacted', 'unerupted',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['universal', 'palmer', 'fdi'] })
  @IsOptional()
  @IsString()
  toothSystem?: string;

  @ApiPropertyOptional({ type: [SurfaceConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurfaceConditionDto)
  conditions?: SurfaceConditionDto[];

  @ApiPropertyOptional({ minimum: 0, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  mobility?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ DENTAL PROCEDURE ============

export class CreateDentalProcedureDto {
  @ApiProperty({ example: 'D0120' })
  @IsString()
  @MaxLength(10)
  code: string;

  @ApiProperty({
    enum: [
      'diagnostic', 'preventive', 'restorative', 'endodontic',
      'periodontic', 'prosthodontic', 'oral_surgery', 'orthodontic', 'implant',
    ],
  })
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultFee?: number;

  @ApiPropertyOptional({ description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;
}

// ============ TREATMENT PLAN ============

export class CreateTreatmentPlanItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5)
  toothNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  surface?: string;

  @ApiProperty()
  @IsUUID()
  procedureId: string;

  @ApiPropertyOptional({ enum: ['urgent', 'high', 'routine', 'elective'], default: 'routine' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  insuranceCoverage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  patientCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTreatmentPlanDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ example: 'Initial Treatment Plan' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateTreatmentPlanItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTreatmentPlanItemDto)
  items: CreateTreatmentPlanItemDto[];
}

export class UpdateTreatmentPlanItemStatusDto {
  @ApiProperty({
    enum: ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'declined'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ DENTAL IMAGE ============

export class UploadDentalImageDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5)
  toothNumber?: string;

  @ApiProperty({
    enum: ['periapical', 'bitewing', 'panoramic', 'cephalometric', 'cbct', 'intraoral_photo'],
  })
  @IsString()
  imageType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fileSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ LAB ORDER ============

export class CreateLabOrderDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  labName: string;

  @ApiProperty({
    enum: [
      'crown', 'bridge', 'denture', 'implant_component', 'veneer',
      'inlay', 'onlay', 'retainer', 'aligner', 'night_guard', 'other',
    ],
  })
  @IsString()
  orderType: string;

  @ApiPropertyOptional({ description: 'Comma-separated tooth numbers, e.g. "3,4,5"' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  toothNumber?: string;

  @ApiPropertyOptional({ description: 'Tooth shade (A1, A2, B1, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shade?: string;

  @ApiPropertyOptional({
    enum: ['porcelain', 'zirconia', 'pfm', 'gold', 'emax', 'acrylic', 'composite'],
  })
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional({ enum: ['digital', 'alginate', 'pvs', 'polyether'] })
  @IsOptional()
  @IsString()
  impressionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLabOrderStatusDto {
  @ApiProperty({
    enum: ['draft', 'sent', 'in_fabrication', 'ready', 'received', 'fitted', 'remake'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ ORTHODONTIC CASE ============

export class CreateOrthoCaseDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({
    enum: [
      'braces_metal', 'braces_ceramic', 'braces_lingual',
      'clear_aligners', 'retainer_only', 'surgical_ortho',
    ],
  })
  @IsString()
  caseType: string;

  @ApiPropertyOptional({ example: 'Class II Division 1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  malocclusion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalAligners?: number;

  @ApiPropertyOptional({ default: 4, description: 'Weeks between adjustments' })
  @IsOptional()
  @IsInt()
  @Min(1)
  adjustmentInterval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOrthoCaseDto {
  @ApiPropertyOptional({
    enum: [
      'braces_metal', 'braces_ceramic', 'braces_lingual',
      'clear_aligners', 'retainer_only', 'surgical_ortho',
    ],
  })
  @IsOptional()
  @IsString()
  caseType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  malocclusion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalAligners?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  currentAligner?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  adjustmentInterval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional({
    enum: ['planning', 'active', 'retention', 'completed', 'discontinued'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordOrthoAdjustmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextAdjustmentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  currentAligner?: number;
}

// ============ PERIODONTAL CHART ============

export class PerioMeasurementDto {
  @ApiProperty({ example: '1' })
  @IsString()
  tooth: string;

  @ApiProperty({ type: [Number], example: [3, 3, 3] })
  @IsArray()
  @IsInt({ each: true })
  buccal: number[];

  @ApiProperty({ type: [Number], example: [3, 3, 3] })
  @IsArray()
  @IsInt({ each: true })
  lingual: number[];

  @ApiProperty({ type: [Number], example: [0, 0, 0] })
  @IsArray()
  @IsInt({ each: true })
  recession: number[];

  @ApiProperty({ type: [Boolean], example: [false, false, false] })
  @IsArray()
  bleeding: boolean[];

  @ApiProperty({ type: [Boolean], example: [false, false, false] })
  @IsArray()
  suppuration: boolean[];
}

export class CreatePerioChartDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ type: [PerioMeasurementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PerioMeasurementDto)
  measurements: PerioMeasurementDto[];

  @ApiPropertyOptional({ description: 'Plaque score percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  plaqueScore?: number;

  @ApiPropertyOptional({ description: 'Bleeding on probing percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  bleedingOnProbing?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
