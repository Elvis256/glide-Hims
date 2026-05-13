import {
  IsString,
  IsEmail,
  IsOptional,
  IsObject,
  MinLength,
  IsArray,
  ValidateNested,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'Kampala Medical Center' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug for login URL',
    example: 'kampala-medical',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ description: 'Organization type', example: 'hospital_network' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'Uganda' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;
}

export class FacilityDto {
  @ApiProperty({ description: 'Facility name', example: 'Main Hospital' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Facility type', example: 'hospital' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'Location/Address', example: 'Plot 123, Kampala Road' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+256-700-123456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'info@hospital.com' })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class AdminUserDto {
  @ApiProperty({ description: 'Full name', example: 'Dr. John Smith' })
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Email address', example: 'admin@hospital.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Username', example: 'admin' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: 'Password', example: 'SecureP@ss123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+256-700-123456' })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class SettingsDto {
  @ApiPropertyOptional({ description: 'Default currency', example: 'UGX' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'Africa/Kampala' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Date format', example: 'DD/MM/YYYY' })
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @ApiPropertyOptional({
    description: 'Deployment mode preset',
    example: 'clinic_opd',
    enum: [
      'single_user',
      'clinic_opd',
      'clinic_full',
      'multisite_opd',
      'hospital',
      'pharmacy_retail',
      'pharmacy_chain',
      'pharmacy_wholesale',
      'dental_general',
      'dental_specialist',
      'optical_center',
      'optical_chain',
    ],
  })
  @IsString()
  @IsIn(
    [
      'single_user',
      'clinic_opd',
      'clinic_full',
      'multisite_opd',
      'hospital',
      'pharmacy_retail',
      'pharmacy_chain',
      'pharmacy_wholesale',
      'dental_general',
      'dental_specialist',
      'optical_center',
      'optical_chain',
    ],
    {
      message: 'facilityMode must be a valid deployment preset',
    },
  )
  @IsOptional()
  facilityMode?: string;

  @ApiPropertyOptional({
    description: 'Enabled modules',
    example: ['lab', 'pharmacy', 'radiology'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  enabledModules?: string[];

  @ApiPropertyOptional({
    description: 'Workflow mode: "simple" (single shared queue) or "departmental" (per-department queues)',
    example: 'simple',
    enum: ['simple', 'departmental'],
  })
  @IsIn(['simple', 'departmental'], { message: 'workflowMode must be "simple" or "departmental"' })
  @IsOptional()
  workflowMode?: 'simple' | 'departmental';
}

export class InitializeSetupDto {
  @ApiProperty({ description: 'Organization details' })
  @ValidateNested()
  @Type(() => OrganizationDto)
  organization: OrganizationDto;

  @ApiProperty({ description: 'Main facility details' })
  @ValidateNested()
  @Type(() => FacilityDto)
  facility: FacilityDto;

  @ApiProperty({ description: 'Admin user details' })
  @ValidateNested()
  @Type(() => AdminUserDto)
  admin: AdminUserDto;

  @ApiPropertyOptional({ description: 'System settings' })
  @ValidateNested()
  @Type(() => SettingsDto)
  @IsOptional()
  settings?: SettingsDto;
}

export class PlanSelectionDto {
  @ApiProperty({ description: 'Plan code (e.g. community, professional, enterprise)' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Billing interval', enum: ['monthly', 'annual'] })
  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingInterval?: 'monthly' | 'annual';
}

export class RegisterTenantDto extends InitializeSetupDto {
  @ApiPropertyOptional({ description: 'Plan selection for self-serve signup' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanSelectionDto)
  plan?: PlanSelectionDto;
}

export class InitializeTenantSetupDto {
  @ApiProperty({ description: 'Main facility details' })
  @ValidateNested()
  @Type(() => FacilityDto)
  facility: FacilityDto;

  @ApiProperty({ description: 'Tenant admin user details' })
  @ValidateNested()
  @Type(() => AdminUserDto)
  admin: AdminUserDto;

  @ApiPropertyOptional({ description: 'System settings' })
  @ValidateNested()
  @Type(() => SettingsDto)
  @IsOptional()
  settings?: SettingsDto;
}
