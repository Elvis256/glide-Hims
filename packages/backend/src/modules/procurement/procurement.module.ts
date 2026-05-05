import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ApprovalDashboardController } from './approval-dashboard.controller';
import { ProcurementService } from './procurement.service';
import { SupplierRiskService } from './supplier-risk.service';
import { ApprovalDashboardService } from './approval-dashboard.service';
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
    ]),
    forwardRef(() => FinanceModule),
    forwardRef(() => UsersModule),
    forwardRef(() => ComplianceModule),
  ],
  controllers: [ProcurementController, ApprovalDashboardController],
  providers: [ProcurementService, SupplierRiskService, ApprovalDashboardService],
  exports: [ProcurementService, SupplierRiskService, ApprovalDashboardService],
})
export class ProcurementModule {}
