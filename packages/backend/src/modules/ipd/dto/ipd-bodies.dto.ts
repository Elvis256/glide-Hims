import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Inline @Body() types on two IPD routes; both erased before the pipe saw them. */
export class ReserveBedDto {
  /** Bounded: an unchecked hold could take a bed out of service indefinitely. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  holdHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class SetExpectedDischargeDto {
  /** null clears the expected date. */
  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsDateString()
  expectedDischargeDate: string | null;
}
