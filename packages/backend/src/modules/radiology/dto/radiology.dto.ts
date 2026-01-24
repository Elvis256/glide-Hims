import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalityType } from '../../../database/entities/imaging-modality.entity';
import { ImagingPriority } from '../../../database/entities/imaging-order.entity';
import { FindingCategory } from '../../../database/entities/imaging-result.entity';

// ============ MODALITY ============
export class CreateModalityDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ModalityType })
  @IsEnum(ModalityType)
  modalityType: ModalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}

// ============ IMAGING ORDER ============
export class CreateImagingOrderDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiProperty()
  @IsUUID()
  modalityId: string;

  @ApiProperty()
  @IsString()
  studyType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalIndication?: string;

  @ApiPropertyOptional({ enum: ImagingPriority })
  @IsOptional()
  @IsEnum(ImagingPriority)
  priority?: ImagingPriority;
}

export class ScheduleImagingDto {
  @ApiProperty()
  @IsDateString()
  scheduledAt: string;
}

export class PerformImagingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technologistNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessionNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  imageCount?: number;
}

// ============ IMAGING RESULT ============
export class CreateImagingResultDto {
  @ApiProperty()
  @IsUUID()
  imagingOrderId: string;

  @ApiProperty()
  @IsString()
  findings: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  impression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiPropertyOptional({ enum: FindingCategory })
  @IsOptional()
  @IsEnum(FindingCategory)
  findingCategory?: FindingCategory;

  @ApiPropertyOptional()
  @IsOptional()
  isCritical?: boolean;
}
