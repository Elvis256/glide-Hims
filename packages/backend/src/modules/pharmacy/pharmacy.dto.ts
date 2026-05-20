import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SaleType,
  SaleChannel,
  TaxPricingMode,
  TaxTreatment,
} from '../../database/entities/pharmacy-sale.entity';

// Shared caps. Quantities and money fields are bounded to keep arithmetic
// well-defined (no Infinity/NaN) and to fail closed if a UI bug or
// adversary submits absurd values that would later crash totals,
// inventory math, or printed receipts.
const MAX_QTY = 1_000_000;
const MAX_MONEY = 100_000_000;
const NUMBER_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class SaleItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsString() @MaxLength(64) itemCode: string;
  @ApiProperty() @IsString() @MaxLength(256) itemName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(1)
  @Max(MAX_QTY)
  quantity: number;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(100)
  discountPercent?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  // Phase A — per-line tax treatment override. If omitted, defaults to STANDARD.
  @ApiProperty({ required: false, enum: TaxTreatment })
  @IsOptional()
  @IsEnum(TaxTreatment)
  taxTreatment?: TaxTreatment;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  taxExemptionReason?: string;
  // Optional explicit per-line VAT rate override (default UG standard 18% for STANDARD treatment).
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class PaymentSplitDto {
  @ApiProperty() @IsString() @MaxLength(64) paymentMethod: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  transactionReference?: string;
}

export class CreatePharmacySaleDto {
  @ApiProperty() @IsUUID() storeId: string;
  @ApiProperty({ enum: SaleType, default: SaleType.OTC })
  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() patientId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerPhone?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  prescriptionId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  transactionReference?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  discountAmount?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  // Phase A — sale channel & POS context
  @ApiProperty({ required: false, enum: SaleChannel, default: SaleChannel.INTERNAL_PHARMACY })
  @IsOptional()
  @IsEnum(SaleChannel)
  saleChannel?: SaleChannel;
  @ApiProperty({ required: false, enum: TaxPricingMode, default: TaxPricingMode.INCLUSIVE })
  @IsOptional()
  @IsEnum(TaxPricingMode)
  taxPricingMode?: TaxPricingMode;
  @ApiProperty({ required: false, description: 'Required when saleChannel = retail_pos' })
  @IsOptional()
  @IsUUID()
  posShiftId?: string;
  @ApiProperty({ required: false, description: 'Required when saleChannel = retail_pos' })
  @IsOptional()
  @IsUUID()
  posRegisterId?: string;

  // ── Phase D — offline mode idempotency ───────────────────────────────────
  @ApiProperty({ required: false, description: 'Client-generated UUID for offline idempotency' })
  @IsOptional()
  @IsUUID()
  clientSaleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  clientSequenceNumber?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  wasOffline?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  originalOfflineTimestamp?: string;
}

// Buyer-identification block for controlled-substance OTC dispense at the counter.
export class ControlledSubstanceBuyerDto {
  @ApiProperty() @IsString() @MaxLength(200) buyerName: string;
  @ApiProperty({
    description: 'national_id | passport | drivers_license | refugee_id | other',
  })
  @IsString()
  @MaxLength(32)
  buyerIdType: string;
  @ApiProperty() @IsString() @MaxLength(64) buyerIdNumber: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(32) buyerPhone?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  prescriberName?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  prescriberLicense?: string;
}

export class CompleteSaleDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amountPaid: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  transactionReference?: string;

  // Phase A — split-tender support (multiple payment methods on one sale)
  @ApiProperty({
    required: false,
    type: [PaymentSplitDto],
    description: 'Optional split-tender: [{paymentMethod, amount, transactionReference}]',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitDto)
  paymentSplits?: PaymentSplitDto[];

  // Phase A — required when any line item is a Schedule II–V controlled substance dispensed
  // outside a prescription path (i.e. retail/POS counter).
  @ApiProperty({ required: false, type: ControlledSubstanceBuyerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ControlledSubstanceBuyerDto)
  controlledSubstanceBuyer?: ControlledSubstanceBuyerDto;
}

export class QuarantineItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ProcessExpiredItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ enum: ['dispose', 'return'] }) @IsEnum(['dispose', 'return'] as const) action:
    | 'dispose'
    | 'return';
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

// Batch Stock DTOs
export class AllocateFEFODto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(1)
  @Max(MAX_QTY)
  quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

export class ReceiveBatchDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty() @IsString() @MaxLength(64) batchNumber: string;
  @ApiProperty() @IsDateString() expiryDate: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(1)
  @Max(MAX_QTY)
  quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

// Drug Label DTOs
export class CreateLabelTemplateDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  // Templates may contain large HTML/ZPL/EPL bodies; 64KB cap is well
  // above any realistic prescription label while preventing arbitrary
  // megabyte uploads.
  @ApiProperty() @IsString() @MaxLength(64_000) content: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(16) language?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(16) format?: string;
}

export class CreateDrugTranslationDto {
  @ApiProperty() @IsString() @MaxLength(256) drugName: string;
  @ApiProperty() @IsString() @MaxLength(16) language: string;
  @ApiProperty() @IsString() @MaxLength(256) translatedName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) directions?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000) warnings?: string;
}

// Temperature Monitoring DTOs
export class RecordTemperatureReadingDto {
  @ApiProperty() @IsString() @MaxLength(64) sensorId: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(-100)
  @Max(200)
  temperature: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(100)
  humidity?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class CreateTemperatureSensorDto {
  @ApiProperty() @IsString() @MaxLength(64) sensorId: string;
  @ApiProperty() @IsString() @MaxLength(200) name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(64) storageType?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(-100)
  @Max(200)
  minTemp?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(-100)
  @Max(200)
  maxTemp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}
