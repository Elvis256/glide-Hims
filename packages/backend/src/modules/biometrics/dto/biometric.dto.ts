import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export type FingerIndex = 
  | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little'
  | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little';

export class RegisterBiometricDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  fingerIndex: FingerIndex;

  @IsString()
  @IsNotEmpty()
  templateData: string; // Base64 encoded fingerprint template

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;
}

export class VerifyBiometricDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  templateData: string; // Base64 encoded fingerprint template to verify
}

export class UpdateStaffCoverageDto {
  @IsNotEmpty()
  enabled: boolean;

  @IsOptional()
  @IsString()
  planType?: string; // 'basic' | 'premium' | 'family'

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsNumber()
  coverageLimit?: number;

  @IsOptional()
  @IsNumber()
  usedAmount?: number;
}
