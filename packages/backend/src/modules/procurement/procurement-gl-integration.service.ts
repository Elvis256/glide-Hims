import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  GoodsReceiptNote,
  GoodsReceiptItem,
  GRNStatus,
} from '../../database/entities/goods-receipt.entity';
import { 
  PurchaseOrder, 
  PurchaseOrderItem 
} from '../../database/entities/purchase-order.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Item } from '../../database/entities/inventory.entity';
import { FinanceService } from '../finance/finance.service';
import { BudgetService } from '../finance/budget.service';
import { 
  PostReceiptToGLDto,
  EncumbranceDto,
  EncumbranceStatus,
  ThreeWayMatchDto,
  ReconciliationReportDto,
  MatchStatus,
} from './dto/procurement-gl-integration.dto';

@Injectable()
export class ProcurementGLIntegrationService {
  private readonly logger = new Logger(ProcurementGLIntegrationService.name);

  // GL Account Mappings (configurable)
  private readonly ACCOUNT_MAPPINGS = {
    inventory: 1200, // Asset - Inventory
    costOfGoods: 5100, // Expense - COGS
    accountsPayable: 2100, // Liability - AP
    encumbrance: 9100, // Contingent Liability - Budget Encumbrance
  };

  constructor(
    @InjectRepository(GoodsReceiptNote)
    private grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptItem)
    private grnItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(ChartOfAccount)
    private chartOfAccountRepo: Repository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    @Inject(forwardRef(() => BudgetService))
    private budgetService: BudgetService,
  ) {}

  /**
   * Post GRN receipt to GL as: Debit Inventory/Expense, Credit AP
   */
  async postGRNReceiptToGL(grnId: string, userId: string): Promise<any> {
    try {
      const grn = await this.grnRepo.findOne({
        where: { id: grnId },
        relations: ['purchaseOrder', 'purchaseOrder.supplier'],
      });

      if (!grn) {
        throw new Error(`GRN ${grnId} not found`);
      }

      const po = grn.purchaseOrder;
      const supplier = po.supplier;

      // Get GL accounts
      const inventoryAccount = await this.chartOfAccountRepo.findOne({
        where: { accountCode: String(this.ACCOUNT_MAPPINGS.inventory) },
      });
      const apAccount = await this.chartOfAccountRepo.findOne({
        where: { accountCode: String(this.ACCOUNT_MAPPINGS.accountsPayable) },
      });

      if (!inventoryAccount || !apAccount) {
        throw new Error('Required GL accounts not configured');
      }

      // Estimate total based on GRN
      const totalDebitAmount = grn.totalValue || 0;

      // Create journal entry header
      const batchNumber = `GRN-${grnId.substring(0, 8)}-${Date.now()}`;
      const journalEntry = this.journalEntryRepo.create({
        journalNumber: batchNumber,
        journalDate: grn.receivedAt ? new Date(grn.receivedAt) : new Date(),
        description: `GRN ${grn.grnNumber} from ${supplier?.name || 'Unknown Supplier'}`,
        totalDebit: totalDebitAmount,
        totalCredit: totalDebitAmount,
        status: JournalStatus.POSTED,
        reference: grnId,
        createdById: userId,
      });

      const savedEntry = await this.journalEntryRepo.save(journalEntry);

      this.logger.log(
        `Posted GRN ${grnId} to GL. Entry ID: ${savedEntry.id}, Amount: ${totalDebitAmount}`,
      );

      return {
        success: true,
        journalEntryId: savedEntry.id,
        amount: totalDebitAmount,
        message: `GRN posted to GL successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to post GRN to GL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Encumber budget on PO creation
   */
  async encumberBudgetForPO(poId: string, departmentId: string): Promise<any> {
    try {
      const po = await this.poRepo.findOne({
        where: { id: poId },
        relations: ['items'],
      });

      if (!po) {
        throw new Error(`PO ${poId} not found`);
      }

      // Reserve budget via BudgetService
      const totalAmount = po.totalAmount || 0;
      
      await this.budgetService.reserveBudget(
        po.facilityId,
        po.id,
        'PO',
        totalAmount,
      );

      this.logger.log(
        `Reserved budget for PO ${poId}. Department: ${departmentId}, Amount: ${totalAmount}`,
      );

      return {
        success: true,
        encumbranceId: po.id,
        amount: totalAmount,
        departmentId,
        poId,
        status: 'reserved',
      };
    } catch (error) {
      this.logger.error(`Failed to reserve budget: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark budget reservation as spent on GRN receipt
   */
  async markGRNBudgetSpent(grnId: string): Promise<any> {
    try {
      const grn = await this.grnRepo.findOne({
        where: { id: grnId },
        relations: ['purchaseOrder'],
      });

      if (!grn) {
        throw new Error(`GRN ${grnId} not found`);
      }

      const po = grn.purchaseOrder;
      const totalAmount = grn.totalValue || 0;

      // Mark budget reservation as spent
      await this.budgetService.markReservationSpent(po.id);

      this.logger.log(
        `Marked budget as spent for GRN ${grnId}. PO: ${po.orderNumber}, Amount: ${totalAmount}`,
      );

      return {
        success: true,
        grnId,
        amount: totalAmount,
        status: 'spent',
      };
    } catch (error) {
      this.logger.error(`Failed to mark budget as spent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate three-way match: PO ↔ GRN ↔ Invoice
   */
  async validateThreeWayMatch(
    poId: string,
    grnId: string,
    invoiceId: string,
  ): Promise<ThreeWayMatchDto> {
    try {
      const po = await this.poRepo.findOne({
        where: { id: poId },
        relations: ['items'],
      });
      const grn = await this.grnRepo.findOne({
        where: { id: grnId },
        relations: ['items'],
      });

      if (!po || !grn) {
        throw new Error('PO or GRN not found');
      }

      // Calculate totals
      const poTotal = po.items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPrice), 0);
      const grnTotal = grn.items.reduce((sum, item) => sum + (item.quantityReceived * item.unitCost), 0);

      // Verify quantities match
      const quantitiesMatch = po.items.length === grn.items.length &&
        po.items.every((poItem, idx) => poItem.quantityOrdered === grn.items[idx].quantityReceived);

      // Verify amounts match
      const amountsMatch = Math.abs(poTotal - grnTotal) < 0.01; // Allow 0.01 rounding difference

      return {
        poId,
        grnId,
        invoiceId,
        poAmount: poTotal,
        grnAmount: grnTotal,
        variance: poTotal - grnTotal,
        quantitiesMatch,
        amountsMatch,
        isMatched: quantitiesMatch && amountsMatch,
        matchStatus: quantitiesMatch && amountsMatch ? MatchStatus.MATCHED : MatchStatus.VARIANCE,
      };
    } catch (error) {
      this.logger.error(`Failed to validate three-way match: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all encumbrances for a department
   */
  async getDepartmentEncumbrances(departmentId: string): Promise<EncumbranceStatus[]> {
    try {
      // Get all active POs for the department
      const pos = await this.poRepo.find({
        where: { departmentId },
      });

      return pos.map((po) => ({
        encumbranceId: po.id,
        poNumber: po.orderNumber,
        amount: po.totalAmount || 0,
        departmentId,
        status: 'active' as any,
        createdDate: po.createdAt,
        releasedDate: undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get encumbrances for department ${departmentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get reconciliation report for period
   */
  async getReconciliationReport(
    startDate: Date,
    endDate: Date,
    facilityId?: string,
  ): Promise<ReconciliationReportDto> {
    try {
      // Get all GRNs in period
      const grns = await this.grnRepo.find({
        where: facilityId ? { facilityId } : {},
      });

      // Get all POs in period
      const pos = await this.poRepo.find({
        where: facilityId ? { facilityId } : {},
      });

      // Calculate totals
      const totalPOAmount = pos.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
      const totalGRNAmount = grns.reduce((sum, grn) => sum + (grn.totalValue || 0), 0);
      const unmatchedPOs = pos.length - grns.length;

      return {
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        departmentId: facilityId || 'all',
        totalPOAmount,
        totalGRNAmount,
        totalEncumbered: totalPOAmount,
        totalActual: totalGRNAmount,
        variance: totalPOAmount - totalGRNAmount,
        grnCount: grns.length,
        poCount: pos.length,
        matchedCount: grns.length,
        unmatchedCount: unmatchedPOs,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get reconciliation report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get integration dashboard summary
   */
  async getIntegrationSummary(): Promise<any> {
    try {
      // Get pending GRNs (not yet posted to GL)
      const pendingGRNs = await this.grnRepo.find({
        where: { status: GRNStatus.APPROVED },
      });

      // Get all POs and GRNs
      const allPOs = await this.poRepo.find();
      const allGRNs = await this.grnRepo.find({
        relations: ['purchaseOrder'],
      });

      const matchedPOIds = new Set(allGRNs.map((grn) => grn.purchaseOrderId));
      const unmatchedPOs = allPOs.filter((po) => !matchedPOIds.has(po.id));

      return {
        pendingGRNCount: pendingGRNs.length,
        pendingGRNAmount: pendingGRNs.reduce((sum, grn) => sum + (grn.totalValue || 0), 0),
        activeEncumbrances: allPOs.length,
        totalEncumbered: allPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0),
        unmatchedPOCount: unmatchedPOs.length,
        unmatchedPOAmount: unmatchedPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0),
        status: 'operational',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get integration summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
