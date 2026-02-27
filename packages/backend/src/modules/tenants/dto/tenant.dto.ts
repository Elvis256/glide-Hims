import { IsString, IsNotEmpty, IsOptional, IsEmail, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Uganda Health Network' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'suspended'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class OnboardTenantDto {
  @ApiProperty({ example: 'Kitintale Medical Center' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantDescription?: string;

  @ApiProperty({ example: 'Kitintale Hospital' })
  @IsString()
  @IsNotEmpty()
  facilityName: string;

  @ApiPropertyOptional({ example: 'hospital' })
  @IsOptional()
  @IsString()
  facilityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilityLocation?: string;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  adminUsername: string;

  @ApiProperty({ example: 'admin@kitintale.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Admin User' })
  @IsString()
  @IsNotEmpty()
  adminFullName: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, any>;
}
