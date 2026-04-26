import { IsString, IsUUID, IsOptional, IsEnum, IsObject, IsArray } from 'class-validator';
import { DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';

export class CreateDeploymentDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  name: string;

  @IsEnum(DeploymentType)
  type: DeploymentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}

export class UpdateDeploymentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DeploymentStatus)
  status?: DeploymentStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;
}

export class DeploymentResponseDto {
  id: string;
  tenantId: string;
  name: string;
  type: DeploymentType;
  status: DeploymentStatus;
  description?: string;
  apiUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateUpdateRolloutDto {
  @IsUUID()
  deploymentId: string;

  @IsUUID()
  versionId: string;

  @IsEnum(['immediate', 'scheduled', 'gradual'])
  strategy: 'immediate' | 'scheduled' | 'gradual';

  @IsOptional()
  @IsObject()
  scheduleConfig?: {
    startTime?: Date;
    endTime?: Date;
  };

  @IsOptional()
  @IsObject()
  gradualConfig?: {
    percentagePerDay?: number;
    maxDeploymentsPerDay?: number;
    autoRollbackOnFailureRate?: number;
  };

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ToggleFeatureFlagDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  deploymentId?: string;

  @IsString()
  featureKey: string;

  isEnabled: boolean | string;
}
