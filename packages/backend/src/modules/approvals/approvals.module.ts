import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction } from '../../database/entities/approval-action.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalAuditListener } from './approval-audit.listener';
import { ProcurementModule } from '../procurement/procurement.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcurementApprovalChain, ApprovalAction]),
    forwardRef(() => ProcurementModule),
    ComplianceModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalAuditListener],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
