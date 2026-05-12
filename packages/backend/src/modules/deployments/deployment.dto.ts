import { IsString, IsUUID, IsOptional, IsEnum, IsObject, IsArray, IsInt, Min, Max } from 'class-validator';
import { DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';

export class ProvisionDeploymentDto {
  @IsString()
  organizationName: string;

  @IsEnum(['hybrid', 'standalone'])
  type: 'hybrid' | 'standalone';

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUsers?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

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
  @IsOptional()
  @IsUUID()
  appVersionId?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsEnum(['immediate', 'scheduled', 'gradual'])
  strategy: 'immediate' | 'scheduled' | 'gradual';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  autoRollbackOnError?: boolean;

  @IsOptional()
  errorThresholdPercentage?: number;

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
