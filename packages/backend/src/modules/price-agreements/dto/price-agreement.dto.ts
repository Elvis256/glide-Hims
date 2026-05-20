import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsArray,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PriceAgreementStatus } from '../../../database/entities/price-agreement.entity';

export class VolumeDiscountDto {
  @IsNumber()
  @Min(1)
  minQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number | null;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;
}

export class CreatePriceAgreementDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  itemCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VolumeDiscountDto)
  volumeDiscounts?: VolumeDiscountDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;
}

export class UpdatePriceAgreementDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VolumeDiscountDto)
  volumeDiscounts?: VolumeDiscountDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  notes?: string;

  @IsOptional()
  @IsEnum(PriceAgreementStatus)
  status?: PriceAgreementStatus;
}

export class ComparePricesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  itemCode: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  quantity?: number;
}
