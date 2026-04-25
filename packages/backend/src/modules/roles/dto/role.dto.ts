import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsObject,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Accountant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;

  @ApiPropertyOptional({ description: 'Parent role ID for inheritance' })
  @IsOptional()
  @IsUUID()
  parentRoleId?: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class CreatePermissionDto {
  @ApiProperty({ example: 'reports.view' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'View Reports' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'reports' })
  @IsOptional()
  @IsString()
  module?: string;
}

export class AssignPermissionDto {
  @ApiProperty()
  @IsUUID()
  permissionId: string;
}

export class CreatePermissionGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}

export class UpdatePermissionGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SetPermissionGroupPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}

export class SetParentRoleDto {
  @ValidateIf((o) => o.parentRoleId !== null)
  @IsUUID()
  parentRoleId: string | null;
}

export class BulkUpdatePermissionsDto {
  @ApiProperty({
    example: { 'patients.view': true, 'patients.create': false },
    description: 'Map of permission codes to enabled state',
  })
  @IsObject()
  permissions: Record<string, boolean>;
}
