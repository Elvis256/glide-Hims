import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ALLERGY_TYPES = ['allergy', 'intolerance'] as const;
const ALLERGY_CATEGORIES = ['medication', 'food', 'environment', 'biologic', 'other'] as const;
const ALLERGY_CRITICALITIES = ['low', 'high', 'unable-to-assess'] as const;
const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
const ALLERGY_STATUSES = ['active', 'inactive', 'resolved', 'entered-in-error'] as const;
const ALLERGY_VERIFICATIONS = ['unconfirmed', 'confirmed', 'refuted'] as const;
const ALLERGY_SOURCES = ['patient-reported', 'family-reported', 'observed', 'imported'] as const;

export class CreatePatientAllergyBodyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  allergen!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  allergenCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  codeSystem?: string;

  @ApiPropertyOptional({ enum: ALLERGY_TYPES })
  @IsOptional()
  @IsIn(ALLERGY_TYPES as unknown as string[])
  type?: (typeof ALLERGY_TYPES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_CATEGORIES })
  @IsOptional()
  @IsIn(ALLERGY_CATEGORIES as unknown as string[])
  category?: (typeof ALLERGY_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_CRITICALITIES })
  @IsOptional()
  @IsIn(ALLERGY_CRITICALITIES as unknown as string[])
  criticality?: (typeof ALLERGY_CRITICALITIES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsIn(ALLERGY_SEVERITIES as unknown as string[])
  severity?: (typeof ALLERGY_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @ApiPropertyOptional({ enum: ALLERGY_VERIFICATIONS })
  @IsOptional()
  @IsIn(ALLERGY_VERIFICATIONS as unknown as string[])
  verification?: (typeof ALLERGY_VERIFICATIONS)[number];

  @ApiPropertyOptional({ enum: ALLERGY_SOURCES })
  @IsOptional()
  @IsIn(ALLERGY_SOURCES as unknown as string[])
  source?: (typeof ALLERGY_SOURCES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePatientAllergyBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  allergen?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  allergenCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  codeSystem?: string;

  @ApiPropertyOptional({ enum: ALLERGY_TYPES })
  @IsOptional()
  @IsIn(ALLERGY_TYPES as unknown as string[])
  type?: (typeof ALLERGY_TYPES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_CATEGORIES })
  @IsOptional()
  @IsIn(ALLERGY_CATEGORIES as unknown as string[])
  category?: (typeof ALLERGY_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_CRITICALITIES })
  @IsOptional()
  @IsIn(ALLERGY_CRITICALITIES as unknown as string[])
  criticality?: (typeof ALLERGY_CRITICALITIES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_SEVERITIES })
  @IsOptional()
  @IsIn(ALLERGY_SEVERITIES as unknown as string[])
  severity?: (typeof ALLERGY_SEVERITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @ApiPropertyOptional({ enum: ALLERGY_STATUSES })
  @IsOptional()
  @IsIn(ALLERGY_STATUSES as unknown as string[])
  status?: (typeof ALLERGY_STATUSES)[number];

  @ApiPropertyOptional({ enum: ALLERGY_VERIFICATIONS })
  @IsOptional()
  @IsIn(ALLERGY_VERIFICATIONS as unknown as string[])
  verification?: (typeof ALLERGY_VERIFICATIONS)[number];

  @ApiPropertyOptional({ enum: ALLERGY_SOURCES })
  @IsOptional()
  @IsIn(ALLERGY_SOURCES as unknown as string[])
  source?: (typeof ALLERGY_SOURCES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
