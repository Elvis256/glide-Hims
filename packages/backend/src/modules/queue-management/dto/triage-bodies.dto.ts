import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Triage bodies. Both were inline object types, so nothing checked them at
 * runtime — including `triageData`, which is stored as-is and read back by the
 * clinicians who decide how urgently a patient is seen.
 *
 * The pipe can only assert that triageData IS an object; its inner shape
 * varies by protocol and stays the service's responsibility. Asserting the
 * outer type still rules out a string or an array arriving where a record is
 * expected, which is what reached storage before.
 */
export class TriageDispositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  disposition?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  triageData?: Record<string, unknown>;
}

export class SaveTriageDataDto {
  @ApiProperty({ type: Object })
  @IsObject()
  triageData: Record<string, unknown>;
}
