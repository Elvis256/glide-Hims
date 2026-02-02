import { IsString, IsOptional, IsUUID, IsDateString, IsNumber, IsEnum, Min, IsArray } from 'class-validator';
import { PriceAgreementStatus } from '../../../database/entities/price-agreement.entity';

export class VolumeDiscountDto {
  @IsNumber()
  @Min(1)
  minQuantity: number;

  @IsOptional()
  @IsNumber()
  maxQuantity?: number | null;

  @IsNumber()
  @Min(0)
  discountPercent: number;
}

export class CreatePriceAgreementDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;

  @IsOptional()
  @IsArray()
  volumeDiscounts?: VolumeDiscountDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePriceAgreementDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsArray()
  volumeDiscounts?: VolumeDiscountDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PriceAgreementStatus)
  status?: PriceAgreementStatus;
}

export class ComparePricesDto {
  @IsString()
  itemCode: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;
}
