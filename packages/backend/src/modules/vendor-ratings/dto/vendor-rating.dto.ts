import { IsString, IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';

export class CreateVendorRatingDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  deliveryTimeRating: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  priceRating: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  serviceRating: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdateVendorRatingDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  deliveryTimeRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priceRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @IsOptional()
  @IsString()
  comments?: string;
}
