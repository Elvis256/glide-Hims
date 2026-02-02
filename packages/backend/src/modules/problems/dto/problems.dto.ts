import { IsUUID, IsOptional, IsString, IsDateString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProblemStatus, ProblemSeverity } from '../../../database/entities/patient-problem.entity';

export class CreateProblemDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customDiagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customIcdCode?: string;

  @ApiProperty({ enum: ProblemStatus, default: ProblemStatus.ACTIVE })
  @IsEnum(ProblemStatus)
  status: ProblemStatus;

  @ApiPropertyOptional({ enum: ProblemSeverity })
  @IsOptional()
  @IsEnum(ProblemSeverity)
  severity?: ProblemSeverity;

  @ApiProperty()
  @IsDateString()
  onsetDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resolvedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;
}

export class UpdateProblemDto extends PartialType(CreateProblemDto) {}

export class ProblemSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: ProblemStatus })
  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}

export class MarkResolvedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  resolvedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
