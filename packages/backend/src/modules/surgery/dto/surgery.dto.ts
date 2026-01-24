import {
  IsUUID,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SurgeryStatus,
  SurgeryPriority,
  SurgeryType,
  AnesthesiaType,
} from '../../../database/entities/surgery-case.entity';
import { ConsumableCategory } from '../../../database/entities/surgery-consumable.entity';

// Schedule a surgery
export class ScheduleSurgeryDto {
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
  theatreId: string;

  @ApiProperty()
  @IsString()
  procedureName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  procedureCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiProperty({ enum: SurgeryType })
  @IsEnum(SurgeryType)
  surgeryType: SurgeryType;

  @ApiProperty({ enum: SurgeryPriority })
  @IsEnum(SurgeryPriority)
  priority: SurgeryPriority;

  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({ description: 'Time in HH:MM format' })
  @IsString()
  scheduledTime: string;

  @ApiProperty()
  @IsInt()
  @Min(15)
  @Max(720)
  estimatedDurationMinutes: number;

  @ApiProperty()
  @IsUUID()
  leadSurgeonId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assistantSurgeonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  anesthesiologistId?: string;

  @ApiPropertyOptional({ enum: AnesthesiaType })
  @IsOptional()
  @IsEnum(AnesthesiaType)
  anesthesiaType?: AnesthesiaType;
}

// Pre-operative checklist
class PreOpChecklistItem {
  @IsString()
  item: string;

  @IsBoolean()
  checked: boolean;

  @IsOptional()
  @IsString()
  checkedBy?: string;

  @IsOptional()
  @IsString()
  checkedAt?: string;
}

export class PreOpChecklistDto {
  @ApiProperty({ type: [PreOpChecklistItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreOpChecklistItem)
  checklist: PreOpChecklistItem[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preOpNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentSigned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bloodAvailable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;
}

// Start surgery
export class StartSurgeryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anesthesiaNotes?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  nursingTeam?: { id: string; name: string; role: string }[];
}

// Intra-operative notes
export class IntraOpNotesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operativeFindings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operativeNotes?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  complications?: { type: string; description: string; time: string }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  bloodLossMl?: number;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  specimensCollected?: { type: string; sentTo: string; labId?: string }[];
}

// Complete surgery
export class CompleteSurgeryDto {
  @ApiProperty()
  @IsString()
  operativeFindings: string;

  @ApiProperty()
  @IsString()
  operativeNotes: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  bloodLossMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postOpDiagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postOpInstructions?: string;

  @ApiProperty({ description: 'Destination: ICU, Ward name, or Home' })
  @IsString()
  dischargeDestination: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recoveryNotes?: string;
}

// Cancel/Postpone surgery
export class CancelSurgeryDto {
  @ApiProperty({ description: 'Reason for cancellation or postponement' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'New date if postponing (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  newDate?: string;

  @ApiPropertyOptional({ description: 'New time if postponing (HH:MM)' })
  @IsOptional()
  @IsString()
  newTime?: string;
}

// Theatre management
export class CreateTheatreDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: ['general', 'orthopedic', 'cardiac', 'neuro', 'obstetric', 'ophthalmic', 'ent', 'minor'] })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateTheatreStatusDto {
  @ApiProperty({ enum: ['available', 'in_use', 'cleaning', 'maintenance', 'out_of_service'] })
  @IsString()
  status: string;
}

// ============ CONSUMABLES ============
export class RecordConsumableDto {
  @ApiProperty()
  @IsUUID()
  surgeryCaseId: string;

  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional({ enum: ConsumableCategory })
  @IsOptional()
  @IsEnum(ConsumableCategory)
  category?: ConsumableCategory;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  quantityUsed: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({ enum: ['pre_op', 'intra_op', 'post_op'] })
  @IsString()
  usagePhase: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  deductFromStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordMultipleConsumablesDto {
  @ApiProperty({ type: [RecordConsumableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordConsumableDto)
  items: RecordConsumableDto[];
}
