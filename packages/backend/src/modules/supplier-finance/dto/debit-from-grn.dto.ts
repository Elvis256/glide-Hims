import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreditNoteReason } from '../../../database/entities/supplier-credit-note.entity';

/**
 * Raising a debit note against a goods receipt. `reason` was typed `any`
 * inside an inline object — the enum exists and is used on the entity, so it
 * is enforced here.
 */
export class CreateDebitFromGrnDto {
  @ApiPropertyOptional({ enum: CreditNoteReason })
  @IsOptional()
  @IsEnum(CreditNoteReason)
  reason?: CreditNoteReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reasonDetails?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
