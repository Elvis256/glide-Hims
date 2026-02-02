import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DiagnosisCategory } from '../../../database/entities/diagnosis.entity';

export class CreateDiagnosisDto {
  @IsString()
  icd10Code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DiagnosisCategory)
  category?: DiagnosisCategory;

  @IsOptional()
  @IsString()
  chapterCode?: string;

  @IsOptional()
  @IsString()
  chapterName?: string;

  @IsOptional()
  @IsString()
  blockCode?: string;

  @IsOptional()
  @IsString()
  blockName?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isNotifiable?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isChronic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedCodes?: string[];
}

export class UpdateDiagnosisDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  shortName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DiagnosisCategory)
  category?: DiagnosisCategory;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isNotifiable?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isChronic?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];
}

export class DiagnosisSearchDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(DiagnosisCategory)
  category?: DiagnosisCategory;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === undefined ? value : false)
  isNotifiable?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === undefined ? value : false)
  isChronic?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === undefined ? value : false)
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;
}
