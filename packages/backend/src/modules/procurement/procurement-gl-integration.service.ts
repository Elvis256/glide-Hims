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
import { PurchaseOrder, PurchaseOrderItem } from '../../database/entities/purchase-order.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Item } from '../../database/entities/inventory.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { FinanceService } from '../finance/finance.service';
import { BudgetService } from '../finance/budget.service';
import {
  EncumbranceDto,
  EncumbranceStatus,
  EncumbranceStatusType,
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
    const tid = requireTenantId(tenantId);
    // audit BUG-010: GRN fetch was tenant-blind, so any user could post any
    // tenant's GRN to its own tenant's GL.
    const grnWhere: any = { id: grnId };
    grnWhere.tenantId = tid;

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
      w.tenantId = tid;
      return w;
    };
    const inventoryAccount = await this.chartOfAccountRepo.findOne({
      where: accountWhere(String(this.ACCOUNT_MAPPINGS.inventory)),
    });
    const apAccount = await this.chartOfAccountRepo.findOne({
      where: accountWhere(String(this.ACCOUNT_MAPPINGS.accountsPayable)),
    });

    if (!inventoryAccount || !apAccount) {
      throw new BadRequestException(
        'Required GL accounts (inventory / accounts payable) not configured',
      );
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
        tenantId: tid,
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
          tenantId: tid,
        }),
        lineRepo.create({
          journalEntryId: savedEntry.id,
          accountId: apAccount.id,
          description: `A/P to ${supplier?.name || 'supplier'} for ${grn.grnNumber}`,
          debit: 0,
          credit: totalAmount,
          lineNumber: 2,
          tenantId: tid,
        }),
      ];
      await lineRepo.save(lines);

      this.logger.log(`Posted GRN ${grnId} to GL. Entry: ${savedEntry.id}, Amount: ${totalAmount}`);

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
  async encumberBudgetForPO(poId: string, departmentId: string, tenantId?: string): Promise<any> {
    const tid = requireTenantId(tenantId);
    const where: any = { id: poId };
    where.tenantId = tid;
    const po = await this.poRepo.findOne({ where, relations: ['items'] });
    if (!po) throw new NotFoundException(`PO ${poId} not found`);

    const totalAmount = Number(po.totalAmount || 0);
    await this.budgetService.reserveBudget(po.facilityId, po.id, 'PO', totalAmount, tid);

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
    const tid = requireTenantId(tenantId);
    const where: any = { id: grnId };
    where.tenantId = tid;
    const grn = await this.grnRepo.findOne({ where, relations: ['purchaseOrder'] });
    if (!grn) throw new NotFoundException(`GRN ${grnId} not found`);

    const po = grn.purchaseOrder;
    if (!po) throw new BadRequestException(`GRN ${grnId} has no purchase order`);
    const totalAmount = Number(grn.totalValue || 0);

    await this.budgetService.markReservationSpent(po.id, tid);

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
    const tid = requireTenantId(tenantId);
    const poWhere: any = { id: poId };
    const grnWhere: any = { id: grnId };
    poWhere.tenantId = tid;
    grnWhere.tenantId = tid;
    const po = await this.poRepo.findOne({ where: poWhere, relations: ['items'] });
    const grn = await this.grnRepo.findOne({ where: grnWhere, relations: ['items'] });

    if (!po || !grn) throw new NotFoundException('PO or GRN not found');

    const poTotal = po.items.reduce(
      (sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitPrice),
      0,
    );

    // What the hospital actually takes on is the accepted quantity, not
    // everything the driver unloaded. Comparing quantityReceived meant a
    // delivery with 20 of 100 rejected still matched at 100, and the
    // supplier was paid for goods that were sent back.
    const acceptedOf = (item: GoodsReceiptItem) =>
      Number(item.quantityAccepted ?? item.quantityReceived) || 0;

    const grnTotal = grn.items.reduce(
      (sum, item) => sum + acceptedOf(item) * Number(item.unitCost),
      0,
    );

    // Match line to line by item, not by array position.
    //
    // This used to pair po.items[i] with grn.items[i]. Neither relation is
    // loaded with an ORDER BY, so the pairing was whatever order Postgres
    // returned — comparing one item's ordered quantity against another
    // item's received quantity. It could flag a clean delivery as a variance
    // and, worse, pass a bad one whenever the mismatched pairs happened to
    // carry equal numbers.
    const receivedByItem = new Map<string, number>();
    for (const grnItem of grn.items) {
      receivedByItem.set(grnItem.itemId, (receivedByItem.get(grnItem.itemId) || 0) + acceptedOf(grnItem));
    }

    const lineDiscrepancies: {
      itemId: string;
      itemName: string;
      quantityOrdered: number;
      quantityAccepted: number;
    }[] = [];

    for (const poItem of po.items) {
      const accepted = receivedByItem.get(poItem.itemId) || 0;
      if (accepted !== Number(poItem.quantityOrdered)) {
        lineDiscrepancies.push({
          itemId: poItem.itemId,
          itemName: poItem.itemName,
          quantityOrdered: Number(poItem.quantityOrdered),
          quantityAccepted: accepted,
        });
      }
    }

    // Anything delivered that was never ordered is a discrepancy too, and
    // the length check this replaces could not see it.
    for (const [itemId, accepted] of receivedByItem) {
      if (!po.items.some((i) => i.itemId === itemId)) {
        const grnItem = grn.items.find((i) => i.itemId === itemId);
        lineDiscrepancies.push({
          itemId,
          itemName: grnItem?.itemName || itemId,
          quantityOrdered: 0,
          quantityAccepted: accepted,
        });
      }
    }

    // The third leg. invoiceId was accepted and echoed straight back without
    // the invoice ever being loaded or compared, which made this a two-way
    // match wearing a three-way name — the document you are about to pay was
    // the one document nobody checked. The supplier's invoice is captured on
    // the GRN, so that is what it is checked against.
    const invoiceAmount = grn.invoiceAmount != null ? Number(grn.invoiceAmount) : null;
    const invoiceMatches = invoiceAmount == null ? null : Math.abs(invoiceAmount - grnTotal) < 0.01;

    const quantitiesMatch = lineDiscrepancies.length === 0;
    const amountsMatch = Math.abs(poTotal - grnTotal) < 0.01;
    const isMatched = quantitiesMatch && amountsMatch && invoiceMatches !== false;

    return {
      poId,
      grnId,
      invoiceId,
      poAmount: poTotal,
      grnAmount: grnTotal,
      invoiceAmount,
      invoiceMatches,
      lineDiscrepancies,
      variance: poTotal - grnTotal,
      quantitiesMatch,
      amountsMatch,
      isMatched,
      matchStatus: isMatched ? MatchStatus.MATCHED : MatchStatus.VARIANCE,
    };
  }

  /**
   * Get all encumbrances for a department
   */
  async getDepartmentEncumbrances(
    departmentId: string,
    tenantId?: string,
  ): Promise<EncumbranceStatus[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { departmentId };
    where.tenantId = tid;
    const pos = await this.poRepo.find({ where });

    return pos.map((po) => ({
      encumbranceId: po.id,
      poNumber: po.orderNumber,
      amount: Number(po.totalAmount || 0),
      departmentId,
      status: EncumbranceStatusType.ACTIVE,
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
    const tid = requireTenantId(tenantId);
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    where.tenantId = tid;
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
    const tid = requireTenantId(tenantId);
    const tenantWhere: any = { tenantId: tid };

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
