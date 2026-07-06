import { IsOptional, IsString, IsEnum, IsUUID, IsDateString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminAuditAction, AdminAuditEntityType } from '../../database/entities/admin-audit-log.entity';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({
    description: 'Filter by admin user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  adminUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    enum: AdminAuditAction,
    description: 'Filter by action type',
    example: AdminAuditAction.CREATE,
  })
  @IsOptional()
  @IsEnum(AdminAuditAction)
  action?: AdminAuditAction;

  @ApiPropertyOptional({
    enum: AdminAuditEntityType,
    description: 'Filter by entity type',
    example: AdminAuditEntityType.ORGANIZATION,
  })
  @IsOptional()
  @IsEnum(AdminAuditEntityType)
  entityType?: AdminAuditEntityType;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class GetEntityAuditTrailDto {
  @ApiProperty({
    enum: AdminAuditEntityType,
    description: 'Entity type',
    example: AdminAuditEntityType.ORGANIZATION,
  })
  @IsEnum(AdminAuditEntityType)
  entityType: AdminAuditEntityType;

  @ApiProperty({
    description: 'Entity ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  entityId: string;
}

export class ExportAuditLogsDto {
  @ApiPropertyOptional({
    description: 'Filter by admin user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  adminUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    enum: AdminAuditAction,
    description: 'Filter by action type',
  })
  @IsOptional()
  @IsEnum(AdminAuditAction)
  action?: AdminAuditAction;

  @ApiPropertyOptional({
    enum: AdminAuditEntityType,
    description: 'Filter by entity type',
  })
  @IsOptional()
  @IsEnum(AdminAuditEntityType)
  entityType?: AdminAuditEntityType;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['csv', 'json'],
    example: 'csv',
  })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';
}

export class AdminActivityReportDto {
  @ApiProperty({
    description: 'Report start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Report end date (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID (omit for all)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
