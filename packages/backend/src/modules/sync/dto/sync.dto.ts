import {
  IsUUID,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SyncOperation, SyncableEntity } from '../../../database/entities/sync-queue.entity';
import { ConflictResolution } from '../../../database/entities/sync-conflict.entity';

export class SyncChangeDto {
  @ApiProperty({ enum: SyncableEntity })
  @IsEnum(SyncableEntity)
  entityType: SyncableEntity;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiProperty({ enum: SyncOperation })
  @IsEnum(SyncOperation)
  operation: SyncOperation;

  @ApiProperty()
  @IsNumber()
  clientVersion: number;

  @ApiProperty()
  @IsNumber()
  clientTimestamp: number;

  @ApiProperty()
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  previousPayload?: Record<string, any>;
}

export class PushChangesDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiProperty({ type: [SyncChangeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncChangeDto)
  changes: SyncChangeDto[];
}

export class PullChangesDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;

  @ApiProperty({ description: 'Unix timestamp of last sync' })
  @IsNumber()
  since: number;

  @ApiPropertyOptional({ description: 'Entity types to pull' })
  @IsOptional()
  @IsArray()
  entityTypes?: SyncableEntity[];

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ResolveConflictDto {
  @ApiProperty({ enum: ConflictResolution })
  @IsEnum(ConflictResolution)
  resolution: ConflictResolution;

  @ApiPropertyOptional({ description: 'Required if resolution is MANUAL or MERGED' })
  @IsOptional()
  @IsObject()
  resolvedPayload?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SyncStatusDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  clientId: string;
}
