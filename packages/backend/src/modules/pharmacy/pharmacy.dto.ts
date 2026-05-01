import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SaleType,
  SaleChannel,
  TaxPricingMode,
  TaxTreatment,
} from '../../database/entities/pharmacy-sale.entity';

export class SaleItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsString() itemCode: string;
  @ApiProperty() @IsString() itemName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() instructions?: string;

  // Phase A — per-line tax treatment override. If omitted, defaults to STANDARD.
  @ApiProperty({ required: false, enum: TaxTreatment })
  @IsOptional()
  @IsEnum(TaxTreatment)
  taxTreatment?: TaxTreatment;
  @ApiProperty({ required: false }) @IsOptional() @IsString() taxCode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() taxExemptionReason?: string;
  // Optional explicit per-line VAT rate override (default UG standard 18% for STANDARD treatment).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreatePharmacySaleDto {
  @ApiProperty() @IsUUID() storeId: string;
  @ApiProperty({ enum: SaleType, default: SaleType.OTC })
  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() patientId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() customerName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() customerPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() prescriptionId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() paymentMethod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transactionReference?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discountAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
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
  @IsNumber()
  clientSequenceNumber?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  wasOffline?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  originalOfflineTimestamp?: string;
}

// Buyer-identification block for controlled-substance OTC dispense at the counter.
export class ControlledSubstanceBuyerDto {
  @ApiProperty() @IsString() buyerName: string;
  @ApiProperty({
    description: 'national_id | passport | drivers_license | refugee_id | other',
  })
  @IsString()
  buyerIdType: string;
  @ApiProperty() @IsString() buyerIdNumber: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() buyerPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() prescriberName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() prescriberLicense?: string;
}

export class CompleteSaleDto {
  @ApiProperty() @IsNumber() @Min(0) amountPaid: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() paymentMethod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transactionReference?: string;

  // Phase A — split-tender support (multiple payment methods on one sale)
  @ApiProperty({
    required: false,
    type: 'array',
    description: 'Optional split-tender: [{paymentMethod, amount, transactionReference}]',
  })
  @IsOptional()
  @IsArray()
  paymentSplits?: Array<{ paymentMethod: string; amount: number; transactionReference?: string }>;

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
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class ProcessExpiredItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ enum: ['dispose', 'return'] }) @IsEnum(['dispose', 'return'] as const) action:
    | 'dispose'
    | 'return';
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

// Batch Stock DTOs
export class AllocateFEFODto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

export class ReceiveBatchDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty() @IsString() batchNumber: string;
  @ApiProperty() @IsDateString() expiryDate: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

// Drug Label DTOs
export class CreateLabelTemplateDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() content: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() language?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() format?: string;
}

export class CreateDrugTranslationDto {
  @ApiProperty() @IsString() drugName: string;
  @ApiProperty() @IsString() language: string;
  @ApiProperty() @IsString() translatedName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() directions?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() warnings?: string;
}

// Temperature Monitoring DTOs
export class RecordTemperatureReadingDto {
  @ApiProperty() @IsString() sensorId: string;
  @ApiProperty() @IsNumber() @Min(-100) temperature: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) humidity?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class CreateTemperatureSensorDto {
  @ApiProperty() @IsString() sensorId: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() storageType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() minTemp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() maxTemp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}
