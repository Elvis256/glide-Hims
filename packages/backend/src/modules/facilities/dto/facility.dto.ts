import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateFacilityDto {
  @ApiProperty({ example: 'City Clinic' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'clinic', enum: ['hospital', 'clinic', 'pharmacy', 'lab'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsUUID()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Parent facility ID for hierarchy' })
  @IsOptional()
  @IsUUID()
  parentFacilityId?: string;

  @ApiPropertyOptional({ example: 'Kampala, Uganda' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  contact?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Outpatient' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'OPD' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
