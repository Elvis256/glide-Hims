import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ApprovalDashboardController } from './approval-dashboard.controller';
import { ProcurementService } from './procurement.service';
import { SupplierRiskService } from './supplier-risk.service';
import { ApprovalDashboardService } from './approval-dashboard.service';
import { ProcurementGLIntegrationService } from './procurement-gl-integration.service';
import { SupplierAnalyticsService } from './supplier-analytics.service';
import { ApprovalAnalyticsService } from './approval-analytics.service';
import { SpendAnalyticsService } from './spend-analytics.service';
import {
  PurchaseRequest,
  PurchaseRequestItem,
} from '../../database/entities/purchase-request.entity';
import { PurchaseOrder, PurchaseOrderItem } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote, GoodsReceiptItem } from '../../database/entities/goods-receipt.entity';
import { InvoiceMatch } from '../../database/entities/invoice-match.entity';
import { StockLedger, StockBalance, Item } from '../../database/entities/inventory.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { VendorQuotation } from '../../database/entities/rfq.entity';
import { ProcurementApprovalThreshold } from '../../database/entities/procurement-approval-threshold.entity';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import {
  Position,
  ApproverGroup,
  ApproverGroupMember,
  ProcurementApprovalPolicy,
  ProcurementApprovalPolicyStep,
  ApprovalDelegation,
} from '../../database/entities/org-approval.entities';
import { Employee } from '../../database/entities/employee.entity';
import { Department } from '../../database/entities/department.entity';
import { OrgApprovalResolverService } from './org-approval-resolver.service';
import { OrgAdminController } from './org-admin.controller';
import { OrgAdminService } from './org-admin.service';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { FinanceModule } from '../finance/finance.module';
import { UsersModule } from '../users/users.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseRequestItem,
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceiptNote,
      GoodsReceiptItem,
      InvoiceMatch,
      StockLedger,
      StockBalance,
      Supplier,
      VendorQuotation,
      Item,
      ProcurementApprovalThreshold,
      ProcurementApprovalChain,
      Position,
      ApproverGroup,
      ApproverGroupMember,
      ProcurementApprovalPolicy,
      ProcurementApprovalPolicyStep,
      ApprovalDelegation,
      Employee,
      Department,
      ChartOfAccount,
      JournalEntry,
    ]),
    forwardRef(() => FinanceModule),
    forwardRef(() => UsersModule),
    forwardRef(() => ComplianceModule),
  ],
  controllers: [ProcurementController, ApprovalDashboardController, OrgAdminController],
  providers: [
    ProcurementService,
    SupplierRiskService,
    ApprovalDashboardService,
    ProcurementGLIntegrationService,
    SupplierAnalyticsService,
    ApprovalAnalyticsService,
    SpendAnalyticsService,
    OrgApprovalResolverService,
    OrgAdminService,
  ],
  exports: [
    ProcurementService,
    SupplierRiskService,
    ApprovalDashboardService,
    ProcurementGLIntegrationService,
    SupplierAnalyticsService,
    ApprovalAnalyticsService,
    SpendAnalyticsService,
    OrgApprovalResolverService,
    OrgAdminService,
  ],
})
export class ProcurementModule {}
