import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';

export class ProvisionDeploymentDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsString()
  organizationName: string;

  @IsEnum(['cloud', 'hybrid', 'standalone'])
  type: 'cloud' | 'hybrid' | 'standalone';

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

/**
 * POST /deployments accepts two shapes and branches on them: a plain
 * deployment record, or a provisioning request that is mapped onto
 * ProvisionDeploymentDto. It was typed `any`, which hid the disagreement —
 * the handler reads organizationName, tier, domain, maxUsers and notes, none
 * of which CreateDeploymentDto declares, and tests `type === 'standalone'`,
 * which is not a DeploymentType at all. Both shapes are declared here so the
 * pipe can check whichever one arrives.
 */
export class CreateDeploymentBodyDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** DeploymentType, widened by the provisioning path's 'standalone'. */
  @IsOptional()
  @IsEnum(['cloud', 'onpremise', 'hybrid', 'standalone'])
  type?: DeploymentType | 'standalone';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  apiUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUsers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
