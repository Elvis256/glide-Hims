import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  IsInt,
  IsDateString,
  IsEnum,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '../../database/entities/prescription.entity';

class PrescriptionItemDto {
  @IsString()
  @MaxLength(64)
  drugCode: string;

  @IsString()
  @MaxLength(256)
  drugName: string;

  @IsString()
  @MaxLength(128)
  dose: string;

  @IsString()
  @MaxLength(128)
  frequency: string;

  @IsString()
  @MaxLength(128)
  duration: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(100000)
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  instructions?: string;
}

export class SafetyOverrideDto {
  @IsString()
  @MaxLength(2000)
  reason: string;

  @IsOptional()
  @IsUUID()
  cosignerId?: string;
}

export class CreatePrescriptionDto {
  @IsUUID()
  encounterId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8192)
  prescriberSignature?: string;

  /**
   * Required if prior call returned 409 SAFETY_BLOCKED. Records an audit
   * trail row in `prescription_safety_overrides`.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SafetyOverrideDto)
  safetyOverride?: SafetyOverrideDto;
}

export class DispenseItemDto {
  @IsUUID()
  prescriptionItemId: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(100000)
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  unitPrice?: number;
}

// Batch dispense DTO - for dispensing all items at once
class DispenseBatchItemDto {
  @IsUUID()
  prescriptionItemId: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(100000)
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  unitPrice?: number;
}

export class DispenseBatchDto {
  @IsUUID()
  prescriptionId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DispenseBatchItemDto)
  items: DispenseBatchItemDto[];

  @IsOptional()
  counselingProvided?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(8192)
  dispenserSignature?: string;

  @IsUUID()
  @IsOptional()
  witnessId?: string;
}

export class PrescriptionQueryDto {
  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 20;
}

export class UpdateStatusDto {
  @IsString()
  @IsIn(['pending', 'dispensing', 'ready', 'collected', 'cancelled'])
  status: 'pending' | 'dispensing' | 'ready' | 'collected' | 'cancelled';

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePrescriptionItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(256)
  drugName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  drugCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  dose?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  frequency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  duration?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(100000)
  @IsOptional()
  quantity?: number;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  instructions?: string;
}

export class AdministerMedicationDto {
  @IsDateString()
  @IsOptional()
  administeredAt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  routeOfAdministration?: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.001)
  @Max(10000)
  @IsOptional()
  doseGiven?: number;

  @IsUUID()
  @IsOptional()
  witnessId?: string;
}

export class AddWitnessDto {
  @IsUUID()
  witnessId: string;

  @IsString()
  @IsOptional()
  @MaxLength(8192)
  witnessSignature?: string;
}

export class DoubleCheckDto {
  @IsUUID()
  checkerId: string;
}

export class NarcoticsRegisterQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  drugSchedule?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number = 50;
}

// Bounded date-range query for analytics endpoints. Without a cap, an
// attacker could send dateFrom=1900-01-01 dateTo=2999-12-31 and force the
// service to load every prescription into memory (getMany() then in-memory
// aggregation in getTimingAnalytics). Mirrors reports.dto MAX_RANGE_DAYS.
export class TimingAnalyticsQueryDto {
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
