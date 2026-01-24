import { IsString, IsOptional, IsUUID, IsNumber, IsEnum, IsBoolean, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { LabTestCategory, LabTestStatus, SampleType } from '../../../database/entities/lab-test.entity';
import { SampleStatus, SamplePriority } from '../../../database/entities/lab-sample.entity';
import { AbnormalFlag } from '../../../database/entities/lab-result.entity';

// Lab Test DTOs
export class ReferenceRangeDto {
  @IsString()
  parameter: string;

  @IsString()
  unit: string;

  @IsNumber()
  @IsOptional()
  normalMin?: number;

  @IsNumber()
  @IsOptional()
  normalMax?: number;

  @IsNumber()
  @IsOptional()
  criticalLow?: number;

  @IsNumber()
  @IsOptional()
  criticalHigh?: number;

  @IsString()
  @IsOptional()
  textNormal?: string;

  @IsString()
  @IsOptional()
  ageGroup?: string;

  @IsString()
  @IsOptional()
  gender?: 'male' | 'female' | 'all';
}

export class CreateLabTestDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(SampleType)
  @IsOptional()
  sampleType?: SampleType;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  turnaroundTimeMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  @IsOptional()
  referenceRanges?: ReferenceRangeDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  components?: string[];

  @IsBoolean()
  @IsOptional()
  requiresFasting?: boolean;

  @IsString()
  @IsOptional()
  specialInstructions?: string;
}

export class UpdateLabTestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(LabTestStatus)
  @IsOptional()
  status?: LabTestStatus;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  turnaroundTimeMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  @IsOptional()
  referenceRanges?: ReferenceRangeDto[];
}

// Sample DTOs
export class CollectSampleDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  patientId: string;

  @IsUUID()
  labTestId: string;

  @IsUUID()
  facilityId: string;

  @IsEnum(SampleType)
  sampleType: SampleType;

  @IsEnum(SamplePriority)
  @IsOptional()
  priority?: SamplePriority;

  @IsString()
  @IsOptional()
  collectionNotes?: string;
}

export class ReceiveSampleDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectSampleDto {
  @IsString()
  rejectionReason: string;
}

export class SampleQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsEnum(SampleStatus)
  @IsOptional()
  status?: SampleStatus;

  @IsEnum(SamplePriority)
  @IsOptional()
  priority?: SamplePriority;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

// Result DTOs
export class EnterResultDto {
  @IsString()
  parameter: string;

  @IsString()
  value: string;

  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  referenceMin?: number;

  @IsNumber()
  @IsOptional()
  referenceMax?: number;

  @IsString()
  @IsOptional()
  referenceRange?: string;

  @IsEnum(AbnormalFlag)
  @IsOptional()
  abnormalFlag?: AbnormalFlag;

  @IsString()
  @IsOptional()
  interpretation?: string;

  @IsString()
  @IsOptional()
  comments?: string;
}

export class ValidateResultDto {
  @IsString()
  @IsOptional()
  comments?: string;
}

export class AmendResultDto {
  @IsString()
  newValue: string;

  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @IsString()
  amendmentReason: string;
}

export class LabTestQueryDto {
  @IsEnum(LabTestCategory)
  @IsOptional()
  category?: LabTestCategory;

  @IsEnum(LabTestStatus)
  @IsOptional()
  status?: LabTestStatus;

  @IsString()
  @IsOptional()
  search?: string;
}
