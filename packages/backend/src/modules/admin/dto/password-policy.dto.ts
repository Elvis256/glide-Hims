import { IsString, IsInt, IsBoolean, IsOptional, IsNotEmpty, Min, Max, IsArray, IsUUID } from 'class-validator';

export class CreatePasswordPolicyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsInt()
  @Min(8)
  @Max(128)
  minLength: number;

  @IsInt()
  @Min(8)
  @Max(256)
  @IsOptional()
  maxLength?: number;

  @IsBoolean()
  @IsOptional()
  requireUppercase?: boolean;

  @IsBoolean()
  @IsOptional()
  requireLowercase?: boolean;

  @IsBoolean()
  @IsOptional()
  requireNumbers?: boolean;

  @IsBoolean()
  @IsOptional()
  requireSpecialChars?: boolean;

  @IsString()
  @IsOptional()
  allowedSpecialChars?: string;

  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  expiryDays?: number;

  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  passwordHistoryCount?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxFailedAttempts?: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  lockoutDurationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  requireMfa?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minAgeDays?: number;

  @IsArray()
  @IsOptional()
  commonPasswordsBlacklist?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePasswordPolicyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsInt()
  @Min(8)
  @Max(128)
  @IsOptional()
  minLength?: number;

  @IsInt()
  @Min(8)
  @Max(256)
  @IsOptional()
  maxLength?: number;

  @IsBoolean()
  @IsOptional()
  requireUppercase?: boolean;

  @IsBoolean()
  @IsOptional()
  requireLowercase?: boolean;

  @IsBoolean()
  @IsOptional()
  requireNumbers?: boolean;

  @IsBoolean()
  @IsOptional()
  requireSpecialChars?: boolean;

  @IsString()
  @IsOptional()
  allowedSpecialChars?: string;

  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  expiryDays?: number;

  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  passwordHistoryCount?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxFailedAttempts?: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  lockoutDurationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  requireMfa?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  minAgeDays?: number;

  @IsArray()
  @IsOptional()
  commonPasswordsBlacklist?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
