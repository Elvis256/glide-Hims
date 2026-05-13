import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction } from '../../database/entities/approval-action.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ProcurementModule } from '../procurement/procurement.module';

/**
 * Cross-cutting Approvals module. Wraps the existing
 * OrgApprovalResolverService (still housed in procurement during Sprint 1)
 * with a generic, polymorphic API so any module can submit a document for
 * approval and subscribe to lifecycle events. A future sprint will move
 * the resolver into this module and rename the underlying tables.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProcurementApprovalChain, ApprovalAction]),
    forwardRef(() => ProcurementModule),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
