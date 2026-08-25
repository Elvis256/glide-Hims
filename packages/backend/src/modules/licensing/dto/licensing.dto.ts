import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const LICENSE_TYPES = ['trial', 'standard', 'professional', 'enterprise'] as const;
type LicenseType = (typeof LICENSE_TYPES)[number];

/**
 * Licensing took its bodies from two TypeScript interfaces and three inline
 * object types. Interfaces do not exist at runtime, so `@Body() dto:
 * GenerateLicenseDto` gave the ValidationPipe nothing to check — the route
 * looked validated and was not.
 *
 * These routes decide what a tenant is entitled to run: which modules are
 * enabled, how many users and facilities, and for how long. A license
 * generated from an unchecked body is an entitlement nobody authorised.
 */
export class GenerateLicenseRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  organizationName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: LICENSE_TYPES })
  @IsIn(LICENSE_TYPES as unknown as string[])
  licenseType: LicenseType;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUsers: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxFacilities: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  /** Bounded: an unchecked value here mints a license valid for centuries. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays: number;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  tenantId: string;
}

export class ActivateLicenseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  licenseKey: string;
}

export class BatchExtendLicensesDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(3650)
  days: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(3650)
  withinDays: number;
}

export class UpdateLicenseDto {
  @ApiPropertyOptional({ enum: LICENSE_TYPES })
  @IsOptional()
  @IsIn(LICENSE_TYPES as unknown as string[])
  licenseType?: LicenseType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxFacilities?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * The heartbeat is posted by deployed instances, so this is one of the few
 * bodies that arrives from outside the operator's own browser. It was an
 * interface too.
 */
export class PhoneHomePayloadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  licenseKey: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  hardwareId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  appVersion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  activeUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalUsers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalPatients?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalEncounters?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  systemInfo?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  usageStats?: Record<string, unknown>;
}

export class ExtendLicenseDaysDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(3650)
  days: number;
}

export class RotateLicenseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(256)
  hardwareId: string;
}

export class GraceExtensionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  extensionDays?: number;
}
