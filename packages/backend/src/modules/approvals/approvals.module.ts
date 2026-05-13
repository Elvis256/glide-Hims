import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction } from '../../database/entities/approval-action.entity';
import { ProcurementApprovalPolicyStep } from '../../database/entities/org-approval.entities';
import { InAppNotification } from '../../database/entities/in-app-notification.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalAuditListener } from './approval-audit.listener';
import { ApprovalsSlaService } from './approvals-sla.service';
import { ApprovalsNotifier } from './approvals-notifier.service';
import { ProcurementModule } from '../procurement/procurement.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcurementApprovalChain,
      ApprovalAction,
      ProcurementApprovalPolicyStep,
      InAppNotification,
    ]),
    forwardRef(() => ProcurementModule),
    ComplianceModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalAuditListener, ApprovalsSlaService, ApprovalsNotifier],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
