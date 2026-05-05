import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceRecord } from './compliance-record.entity';
import { ComplianceController } from './compliance.controller';
import { AuditService } from './audit.service';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceRecord, AuditLog])],
  controllers: [ComplianceController],
  providers: [AuditService],
  exports: [AuditService],
})
export class ComplianceModule {}
