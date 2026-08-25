import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Two pharmacy safety routes that took inline object types.
 *
 * interaction-override records a pharmacist deciding to dispense despite a
 * drug-interaction warning. It is an audit record of a clinical override, and
 * `reason` is the whole point of it — under an inline type nothing required
 * the reason to be present or to be a string, so an override could be recorded
 * with no stated justification at all.
 */

/** drug1 is whatever is being dispensed: id and name only. */
export class InteractionDrugDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;
}

/**
 * drug2 is the drug it interacts with, and it carries where that drug came
 * from — the current cart or the patient's history. The service types this as
 * required, and it decides how the warning reads, so it is required here too.
 */
export class InteractionCounterpartDrugDto extends InteractionDrugDto {
  @ApiProperty({ enum: ['cart', 'history'] })
  @IsIn(['cart', 'history'])
  source: 'cart' | 'history';
}

export class InteractionWarningDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  severity: string;

  @ApiProperty({ type: InteractionDrugDto })
  @ValidateNested()
  @Type(() => InteractionDrugDto)
  drug1: InteractionDrugDto;

  @ApiProperty({ type: InteractionCounterpartDrugDto })
  @ValidateNested()
  @Type(() => InteractionCounterpartDrugDto)
  drug2: InteractionCounterpartDrugDto;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  mechanism: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  recommendation: string;

  @ApiProperty()
  @IsBoolean()
  requireOverride: boolean;
}

export class InteractionOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  /**
   * The warnings being overridden, kept for the audit trail. Modelled rather
   * than left as unknown[]: this array is the evidence of what the pharmacist
   * was actually shown when they decided to dispense.
   */
  @ApiProperty({ type: [InteractionWarningDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InteractionWarningDto)
  warnings: InteractionWarningDto[];

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerApproverId?: string;
}

export class ControlledCountDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  /** A physical count is a whole number and cannot be negative. */
  @ApiProperty()
  @IsInt()
  @Min(0)
  physicalCount: number;
}

export class ReconcileControlledDto {
  @ApiProperty({ type: [ControlledCountDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ControlledCountDto)
  counts: ControlledCountDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
