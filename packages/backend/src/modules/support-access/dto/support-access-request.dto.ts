import { IsInt, IsString, IsOptional, Min, Max, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupportAccessRequestDto {
  @ApiProperty({ description: 'Requested access tier (1-3)', minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  requestedTier: number;

  @ApiProperty({ description: 'Requested duration in hours (1-72)', minimum: 1, maximum: 72 })
  @IsInt()
  @Min(1)
  @Max(72)
  requestedDurationHours: number;

  @ApiProperty({ description: 'Reason for requesting support access', minLength: 10 })
  @IsString()
  @MinLength(10)
  reason: string;
}

export class DenySupportAccessRequestDto {
  @ApiPropertyOptional({ description: 'Notes explaining why the request was denied' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
