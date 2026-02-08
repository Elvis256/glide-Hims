import { IsString, IsEmail, IsOptional, IsObject, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationDto {
  @ApiProperty({ description: 'Organization name', example: 'Kampala Medical Center' })
  @IsString()
  name: string;

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

  @ApiPropertyOptional({ description: 'Enabled modules', example: ['lab', 'pharmacy', 'radiology'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  enabledModules?: string[];
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
