import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { TenantService } from '../tenants/services';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { TrashController } from './controllers/trash.controller';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, AuditLog])],
  providers: [AdminService, TenantService],
  controllers: [AdminController, TrashController, AuditLogsController],
  exports: [AdminService, TenantService],
})
export class AdminModule {}
