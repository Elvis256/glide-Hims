import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceRecord } from './compliance-record.entity';
import { ComplianceEvidence } from '../../database/entities/compliance-evidence.entity';
import { Backup } from '../../database/entities/backup.entity';
import { ComplianceController } from './compliance.controller';
import { ComplianceAutomationController } from './compliance-automation.controller';
import { AuditService } from './audit.service';
import { ComplianceAutomationService } from './compliance-automation.service';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceRecord, ComplianceEvidence, AuditLog, Backup])],
  controllers: [ComplianceController, ComplianceAutomationController],
  providers: [AuditService, ComplianceAutomationService],
  exports: [AuditService, ComplianceAutomationService],
})
export class ComplianceModule {}
