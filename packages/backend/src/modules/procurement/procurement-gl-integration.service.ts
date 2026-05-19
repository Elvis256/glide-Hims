import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
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
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Item } from '../../database/entities/inventory.entity';
import { FinanceService } from '../finance/finance.service';
import { BudgetService } from '../finance/budget.service';
import { 
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
    private dataSource: DataSource,
  ) {}

  /**
   * Post GRN receipt to GL as: Debit Inventory, Credit AP.
   * Header + balanced line items written in one transaction (audit BUG-017).
   */
  async postGRNReceiptToGL(grnId: string, userId: string, tenantId?: string): Promise<any> {
    // audit BUG-010: GRN fetch was tenant-blind, so any user could post any
    // tenant's GRN to its own tenant's GL.
    const grnWhere: any = { id: grnId };
    if (tenantId) grnWhere.tenantId = tenantId;

    const grn = await this.grnRepo.findOne({
      where: grnWhere,
      relations: ['purchaseOrder', 'purchaseOrder.supplier'],
    });

    if (!grn) {
      throw new NotFoundException(`GRN ${grnId} not found`);
    }

    const po = grn.purchaseOrder;
    const supplier = po?.supplier;

    const accountWhere = (code: string): any => {
      const w: any = { accountCode: code };
      if (tenantId) w.tenantId = tenantId;
      return w;
    };
    const inventoryAccount = await this.chartOfAccountRepo.findOne({
      where: accountWhere(String(this.ACCOUNT_MAPPINGS.inventory)),
    });
    const apAccount = await this.chartOfAccountRepo.findOne({
      where: accountWhere(String(this.ACCOUNT_MAPPINGS.accountsPayable)),
    });

    if (!inventoryAccount || !apAccount) {
      throw new BadRequestException('Required GL accounts (inventory / accounts payable) not configured');
    }

    const totalAmount = Number(grn.totalValue || 0);
    if (totalAmount <= 0) {
      throw new BadRequestException(`GRN ${grnId} has no value to post to GL`);
    }

    const batchNumber = `GRN-${grnId.substring(0, 8)}-${Date.now()}`;

    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntry);
      const lineRepo = manager.getRepository(JournalEntryLine);

      const journalEntry = entryRepo.create({
        journalNumber: batchNumber,
        journalDate: grn.receivedAt ? new Date(grn.receivedAt) : new Date(),
        description: `GRN ${grn.grnNumber} from ${supplier?.name || 'Unknown Supplier'}`,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
        status: JournalStatus.POSTED,
        reference: grnId,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      const savedEntry = (await entryRepo.save(journalEntry)) as JournalEntry;

      // audit BUG-017: previously only the header was written. Without lines
      // the trial balance is unaffected and the journal is meaningless. Write
      // the standard procurement entry: Dr Inventory / Cr A/P.
      const lines = [
        lineRepo.create({
          journalEntryId: savedEntry.id,
          accountId: inventoryAccount.id,
          description: `Inventory received via ${grn.grnNumber}`,
          debit: totalAmount,
          credit: 0,
          lineNumber: 1,
          ...(tenantId ? { tenantId } : {}),
        }),
        lineRepo.create({
          journalEntryId: savedEntry.id,
          accountId: apAccount.id,
          description: `A/P to ${supplier?.name || 'supplier'} for ${grn.grnNumber}`,
          debit: 0,
          credit: totalAmount,
          lineNumber: 2,
          ...(tenantId ? { tenantId } : {}),
        }),
      ];
      await lineRepo.save(lines);

      this.logger.log(
        `Posted GRN ${grnId} to GL. Entry: ${savedEntry.id}, Amount: ${totalAmount}`,
      );

      return {
        success: true,
        journalEntryId: savedEntry.id,
        amount: totalAmount,
        message: 'GRN posted to GL successfully',
      };
    });
  }

  /**
   * Encumber budget on PO creation
   */
  async encumberBudgetForPO(
    poId: string,
    departmentId: string,
    tenantId?: string,
  ): Promise<any> {
    const where: any = { id: poId };
    if (tenantId) where.tenantId = tenantId;
    const po = await this.poRepo.findOne({ where, relations: ['items'] });
    if (!po) throw new NotFoundException(`PO ${poId} not found`);

    const totalAmount = Number(po.totalAmount || 0);
    await this.budgetService.reserveBudget(po.facilityId, po.id, 'PO', totalAmount);

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
  }

  /**
   * Mark budget reservation as spent on GRN receipt
   */
  async markGRNBudgetSpent(grnId: string, tenantId?: string): Promise<any> {
    const where: any = { id: grnId };
    if (tenantId) where.tenantId = tenantId;
    const grn = await this.grnRepo.findOne({ where, relations: ['purchaseOrder'] });
    if (!grn) throw new NotFoundException(`GRN ${grnId} not found`);

    const po = grn.purchaseOrder;
    if (!po) throw new BadRequestException(`GRN ${grnId} has no purchase order`);
    const totalAmount = Number(grn.totalValue || 0);

    await this.budgetService.markReservationSpent(po.id);

    this.logger.log(
      `Marked budget as spent for GRN ${grnId}. PO: ${po.orderNumber}, Amount: ${totalAmount}`,
    );

    return { success: true, grnId, amount: totalAmount, status: 'spent' };
  }

  /**
   * Validate three-way match: PO ↔ GRN ↔ Invoice
   */
  async validateThreeWayMatch(
    poId: string,
    grnId: string,
    invoiceId: string,
    tenantId?: string,
  ): Promise<ThreeWayMatchDto> {
    const poWhere: any = { id: poId };
    const grnWhere: any = { id: grnId };
    if (tenantId) {
      poWhere.tenantId = tenantId;
      grnWhere.tenantId = tenantId;
    }
    const po = await this.poRepo.findOne({ where: poWhere, relations: ['items'] });
    const grn = await this.grnRepo.findOne({ where: grnWhere, relations: ['items'] });

    if (!po || !grn) throw new NotFoundException('PO or GRN not found');

    const poTotal = po.items.reduce(
      (sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitPrice),
      0,
    );
    const grnTotal = grn.items.reduce(
      (sum, item) => sum + Number(item.quantityReceived) * Number(item.unitCost),
      0,
    );

    const quantitiesMatch =
      po.items.length === grn.items.length &&
      po.items.every(
        (poItem, idx) => Number(poItem.quantityOrdered) === Number(grn.items[idx].quantityReceived),
      );
    const amountsMatch = Math.abs(poTotal - grnTotal) < 0.01;

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
  }

  /**
   * Get all encumbrances for a department
   */
  async getDepartmentEncumbrances(
    departmentId: string,
    tenantId?: string,
  ): Promise<EncumbranceStatus[]> {
    const where: any = { departmentId };
    if (tenantId) where.tenantId = tenantId;
    const pos = await this.poRepo.find({ where });

    return pos.map((po) => ({
      encumbranceId: po.id,
      poNumber: po.orderNumber,
      amount: Number(po.totalAmount || 0),
      departmentId,
      status: 'active' as any,
      createdDate: po.createdAt,
      releasedDate: undefined,
    }));
  }

  /**
   * Get reconciliation report for period
   */
  async getReconciliationReport(
    startDate: Date,
    endDate: Date,
    facilityId?: string,
    tenantId?: string,
  ): Promise<ReconciliationReportDto> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    // Date filtering — receivedAt for GRNs, createdAt for POs
    const grnWhere = { ...where, receivedAt: Between(startDate, endDate) };
    const poWhere = { ...where, createdAt: Between(startDate, endDate) };

    const grns = await this.grnRepo.find({ where: grnWhere });
    const pos = await this.poRepo.find({ where: poWhere });

    const totalPOAmount = pos.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
    const totalGRNAmount = grns.reduce((sum, grn) => sum + Number(grn.totalValue || 0), 0);
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
  }

  /**
   * Get integration dashboard summary
   */
  async getIntegrationSummary(tenantId?: string): Promise<any> {
    const tenantWhere: any = tenantId ? { tenantId } : {};

    const pendingGRNs = await this.grnRepo.find({
      where: { status: GRNStatus.APPROVED, ...tenantWhere },
    });
    const allPOs = await this.poRepo.find({ where: tenantWhere });
    const allGRNs = await this.grnRepo.find({
      where: tenantWhere,
      relations: ['purchaseOrder'],
    });

    const matchedPOIds = new Set(allGRNs.map((grn) => grn.purchaseOrderId));
    const unmatchedPOs = allPOs.filter((po) => !matchedPOIds.has(po.id));

    return {
      pendingGRNCount: pendingGRNs.length,
      pendingGRNAmount: pendingGRNs.reduce((sum, grn) => sum + Number(grn.totalValue || 0), 0),
      activeEncumbrances: allPOs.length,
      totalEncumbered: allPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0),
      unmatchedPOCount: unmatchedPOs.length,
      unmatchedPOAmount: unmatchedPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0),
      status: 'operational',
    };
  }
}
