import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============ COVERAGE CHECK DTOs ============

export class CoverageCheckItemDto {
  @ApiProperty()
  @IsUUID()
  drugId: string;

  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(100_000)
  quantity: number;
}

export class CheckCoverageDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ type: [CoverageCheckItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CoverageCheckItemDto)
  items: CoverageCheckItemDto[];
}

export class CoverageDetailResponse {
  drugId: string;
  covered: boolean;
  copayAmount: number;
  requiresPreAuth: boolean;
  rejectionReason?: string;
}

export class CheckCoverageResponseDto {
  covered: boolean;
  coverageDetails: CoverageDetailResponse[];
}

// ============ ADHERENCE DTOs ============

export class RecordAdherenceDto {
  @ApiProperty({ enum: ['taken', 'skipped'] })
  @IsEnum({ taken: 'taken', skipped: 'skipped' })
  status: 'taken' | 'skipped';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  skipReason?: string;
}

export class GetAdherenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
