import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { UpdateManagementService } from './update-management.service';
import { FeatureFlagService } from './feature-flag.service';
import { ReplicationService } from './replication.service';
import { MonitoringService } from './monitoring.service';
import { UpdateDistributionService } from './update-distribution.service';
import { RolloutOrchestrationService } from './rollout-orchestration.service';
import { RolloutSchedulerService } from './rollout-scheduler.service';
import { MasterDataSyncService } from './master-data-sync.service';
import { ConflictResolutionEngine } from './conflict-resolution.service';
import { HealthMetricsCollectorService } from './health-metrics-collector.service';
import { AlertingService } from './alerting.service';
import { TenantsModule } from '../tenants/tenants.module';
import { LicensingModule } from '../licensing/licensing.module';
import { BackupModule } from '../backup/backup.module';
import { Deployment } from '../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../database/entities/deployment-config.entity';
import { TenantFeatureModule } from '../../database/entities/tenant-feature-module.entity';
import { UpdateRollout } from '../../database/entities/update-rollout.entity';
import { ReleaseCandidate } from '../../database/entities/release-candidate.entity';
import { AppVersion } from '../../database/entities/app-version.entity';
import { ReplicationLog } from '../../database/entities/replication-log.entity';
import { ChangeSet } from '../../database/entities/changeset.entity';
import { DeploymentHealth } from '../../database/entities/deployment-health.entity';
import { DeploymentAlert } from '../../database/entities/deployment-alert.entity';
import { License } from '../../database/entities/license.entity';
import { DeploymentReport } from '../../database/entities/deployment-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Deployment,
      DeploymentVersion,
      DeploymentConfig,
      TenantFeatureModule,
      UpdateRollout,
      ReleaseCandidate,
      AppVersion,
      ReplicationLog,
      ChangeSet,
      DeploymentHealth,
      DeploymentAlert,
      License,
      DeploymentReport,
    ]),
    TenantsModule,
    LicensingModule,
    BackupModule,
  ],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    UpdateManagementService,
    FeatureFlagService,
    ReplicationService,
    MonitoringService,
    UpdateDistributionService,
    RolloutOrchestrationService,
    RolloutSchedulerService,
    MasterDataSyncService,
    ConflictResolutionEngine,
    HealthMetricsCollectorService,
    AlertingService,
  ],
  exports: [
    DeploymentService,
    UpdateManagementService,
    FeatureFlagService,
    ReplicationService,
    MonitoringService,
    UpdateDistributionService,
    RolloutOrchestrationService,
    MasterDataSyncService,
    ConflictResolutionEngine,
    HealthMetricsCollectorService,
    AlertingService,
  ],
})
export class DeploymentsModule {}
