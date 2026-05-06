import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { TenantService } from '../tenants/services';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { TrashController } from './controllers/trash.controller';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { PasswordPoliciesController } from './controllers/password-policies.controller';
import { JobMonitorController } from './controllers/job-monitor.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { DepartmentsController } from './controllers/departments.controller';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Department } from '../../database/entities/department.entity';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, AuditLog, Department]), AuthModule, SystemSettingsModule],
  providers: [AdminService, TenantService],
  controllers: [
    AdminController,
    TrashController,
    AuditLogsController,
    PasswordPoliciesController,
    JobMonitorController,
    IntegrationsController,
    DepartmentsController,
  ],
  exports: [AdminService, TenantService],
})
export class AdminModule {}
