import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID } from 'class-validator';

// Category DTOs
export class CreateCategoryDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isDrugCategory?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBatchTracking?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresExpiryTracking?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isDrugCategory?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBatchTracking?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresExpiryTracking?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Subcategory DTOs
export class CreateSubcategoryDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateSubcategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Brand DTOs
export class CreateBrandDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @IsOptional()
  @IsNumber()
  qualityRating?: number;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @IsOptional()
  @IsNumber()
  qualityRating?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Tag DTOs
export class CreateTagDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  tagType?: string;

  @IsOptional()
  @IsBoolean()
  isWarning?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  tagType?: string;

  @IsOptional()
  @IsBoolean()
  isWarning?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Unit DTOs
export class CreateUnitDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  abbreviation?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isBaseUnit?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  abbreviation?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isBaseUnit?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Formulation DTOs
export class CreateFormulationDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  routeOfAdmin?: string;
}

export class UpdateFormulationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  routeOfAdmin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Storage Condition DTOs
export class CreateStorageConditionDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  minTemp?: number;

  @IsOptional()
  @IsNumber()
  maxTemp?: number;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdateStorageConditionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  minTemp?: number;

  @IsOptional()
  @IsNumber()
  maxTemp?: number;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
