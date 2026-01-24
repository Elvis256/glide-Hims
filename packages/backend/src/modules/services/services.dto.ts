import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsUUID, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ServiceTier } from '../../database/entities/service-category.entity';

export class CreateServiceCategoryDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() parentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateServiceCategoryDto extends PartialType(CreateServiceCategoryDto) {}

export class CreateServiceDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsUUID() categoryId: string;
  @ApiProperty({ enum: ServiceTier }) @IsEnum(ServiceTier) tier: ServiceTier;
  @ApiProperty() @IsNumber() basePrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isPackage?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() durationMinutes?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() requiresAppointment?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class CreateServicePriceDto {
  @ApiProperty() @IsUUID() serviceId: string;
  @ApiProperty({ enum: ServiceTier }) @IsEnum(ServiceTier) tier: ServiceTier;
  @ApiProperty() @IsNumber() price: number;
  @ApiProperty() @IsDateString() effectiveFrom: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() effectiveTo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class CreateServicePackageDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() packagePrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() validDays?: number;
  @ApiProperty() @IsArray() includedServices: { serviceId: string; quantity: number }[];
}
