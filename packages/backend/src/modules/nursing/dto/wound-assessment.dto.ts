import { IsUUID, IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateWoundAssessmentDto {
  @IsUUID()
  admissionId: string;

  @IsString()
  location: string;

  @IsString()
  woundType: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  depth?: number;

  @IsOptional()
  @IsObject()
  woundBed?: { granulation?: number; slough?: number; necrotic?: number; epithelial?: number };

  @IsOptional()
  @IsObject()
  exudate?: { amount: string; type: string; color?: string };

  @IsOptional()
  @IsString()
  periwoundSkin?: string;

  @IsOptional()
  @IsString()
  treatment?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryWoundAssessmentDto {
  @IsOptional()
  @IsUUID()
  admissionId?: string;
}
