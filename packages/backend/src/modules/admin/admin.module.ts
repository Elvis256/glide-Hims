import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { TenantService } from '../tenants/services';
import { AdminService } from './services/admin.service';
import { AdminMFAService } from './services/admin-mfa.service';
import { AdminController } from './controllers/admin.controller';
import { AdminMFAController } from './controllers/admin-mfa.controller';
import { TrashController } from './controllers/trash.controller';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { PasswordPoliciesController } from './controllers/password-policies.controller';
import { JobMonitorController } from './controllers/job-monitor.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { DepartmentsController } from './controllers/departments.controller';
import { SystemHealthController } from './controllers/system-health.controller';
import { SystemHealthService } from './services/system-health.service';
import { SystemRbacController } from './controllers/system-rbac.controller';
import { SystemRbacService } from './services/system-rbac.service';
import { ApiKeyController } from './controllers/api-key.controller';
import { ApiKeyService } from './services/api-key.service';
import { RevenueAnalyticsController } from './controllers/revenue-analytics.controller';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Department } from '../../database/entities/department.entity';
import { Deployment } from '../../database/entities/deployment.entity';
import { SystemMetric } from '../../database/entities/system-metric.entity';
import { AlertRule } from '../../database/entities/alert-rule.entity';
import { SystemAlert } from '../../database/entities/system-alert.entity';
import { Session } from '../../database/entities/session.entity';
import { SystemAdminRole, SystemAdminRoleAssignment } from '../../database/entities/system-admin-role.entity';
import { ApiKey, WebhookDeliveryLog } from '../../database/entities/api-key.entity';
import { User } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      AuditLog,
      Department,
      Deployment,
      SystemMetric,
      AlertRule,
      SystemAlert,
      Session,
      SystemAdminRole,
      SystemAdminRoleAssignment,
      ApiKey,
      WebhookDeliveryLog,
    ]),
    AuthModule,
    SystemSettingsModule,
    InAppNotificationsModule,
  ],
  providers: [
    AdminService,
    AdminMFAService,
    TenantService,
    SystemHealthService,
    SystemRbacService,
    ApiKeyService,
    RevenueAnalyticsService,
  ],
  controllers: [
    AdminController,
    AdminMFAController,
    TrashController,
    AuditLogsController,
    PasswordPoliciesController,
    JobMonitorController,
    IntegrationsController,
    DepartmentsController,
    SystemHealthController,
    SystemRbacController,
    ApiKeyController,
    RevenueAnalyticsController,
  ],
  exports: [AdminService, AdminMFAService, TenantService, SystemHealthService, SystemRbacService, ApiKeyService],
})
export class AdminModule {}
