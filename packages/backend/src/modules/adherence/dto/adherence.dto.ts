import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class RecordAdherenceDto {
  @ApiProperty({ enum: ['taken', 'skipped'] })
  @IsEnum({ taken: 'taken', skipped: 'skipped' })
  status: 'taken' | 'skipped';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skipReason?: string;
}

export class GetAdherenceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
