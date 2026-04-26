import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { UpdateManagementService } from './update-management.service';
import { FeatureFlagService } from './feature-flag.service';
import { ReplicationService } from './replication.service';
import { MonitoringService } from './monitoring.service';
import { Deployment } from '../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../database/entities/deployment-config.entity';
import { TenantFeatureModule } from '../../database/entities/tenant-feature-module.entity';
import { UpdateRollout } from '../../database/entities/update-rollout.entity';
import { ReplicationLog } from '../../database/entities/replication-log.entity';
import { ChangeSet } from '../../database/entities/changeset.entity';
import { DeploymentHealth } from '../../database/entities/deployment-health.entity';
import { DeploymentAlert } from '../../database/entities/deployment-alert.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Deployment,
      DeploymentVersion,
      DeploymentConfig,
      TenantFeatureModule,
      UpdateRollout,
      ReplicationLog,
      ChangeSet,
      DeploymentHealth,
      DeploymentAlert,
    ]),
  ],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    UpdateManagementService,
    FeatureFlagService,
    ReplicationService,
    MonitoringService,
  ],
  exports: [
    DeploymentService,
    UpdateManagementService,
    FeatureFlagService,
    ReplicationService,
    MonitoringService,
  ],
})
export class DeploymentsModule {}
