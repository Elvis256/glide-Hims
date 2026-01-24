import { IsString, IsOptional, IsBoolean, IsEnum, IsArray } from 'class-validator';
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
  isNotifiable?: boolean;

  @IsOptional()
  @IsBoolean()
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
  isNotifiable?: boolean;

  @IsOptional()
  @IsBoolean()
  isChronic?: boolean;

  @IsOptional()
  @IsBoolean()
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
  @IsBoolean()
  isNotifiable?: boolean;

  @IsOptional()
  @IsBoolean()
  isChronic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
