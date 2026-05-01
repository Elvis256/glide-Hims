import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import {
  SupplierPayment,
  SupplierPaymentItem,
  PaymentVoucherStatus,
  PaymentMethod,
} from '../../database/entities/supplier-payment.entity';
import {
  SupplierCreditNote,
  SupplierCreditNoteItem,
  CreditNoteStatus,
  CreditNoteType,
  CreditNoteReason,
} from '../../database/entities/supplier-credit-note.entity';
import { Supplier, SupplierStatus } from '../../database/entities/supplier.entity';
import { GoodsReceiptNote, GRNStatus } from '../../database/entities/goods-receipt.entity';
import { FinanceService } from '../finance/finance.service';
import { BudgetService } from '../finance/budget.service';

@Injectable()
export class SupplierFinanceService {
  constructor(
    @InjectRepository(SupplierPayment)
    private paymentRepo: Repository<SupplierPayment>,
    @InjectRepository(SupplierPaymentItem)
    private paymentItemRepo: Repository<SupplierPaymentItem>,
    @InjectRepository(SupplierCreditNote)
    private creditNoteRepo: Repository<SupplierCreditNote>,
    @InjectRepository(SupplierCreditNoteItem)
    private creditNoteItemRepo: Repository<SupplierCreditNoteItem>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(GoodsReceiptNote)
    private grnRepo: Repository<GoodsReceiptNote>,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    private budgetService: BudgetService,
  ) {}

  // ==================== SUPPLIER PAYMENTS ====================

  private async generateVoucherNumber(facilityId: string): Promise<string> {
    const count = await this.paymentRepo.count({ where: { facilityId } });
    const date = new Date();
    return `PV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createPaymentVoucher(
    data: {
      facilityId: string;
      supplierId: string;
      purchaseOrderId?: string;
      paymentDate: Date;
      grossAmount: number;
      withholdingTax?: number;
      otherDeductions?: number;
      paymentMethod: PaymentMethod;
      chequeNumber?: string;
      bankReference?: string;
      bankName?: string;
      accountNumber?: string;
      description?: string;
      remarks?: string;
      items: Array<{
        description: string;
        invoiceNumber?: string;
        invoiceDate?: Date;
        amount: number;
        grnId?: string;
      }>;
    },
    userId: string,
    tenantId?: string,
  ): Promise<SupplierPayment> {
    const voucherNumber = await this.generateVoucherNumber(data.facilityId);

    const withholdingTax = data.withholdingTax || 0;
    const otherDeductions = data.otherDeductions || 0;
    const netAmount = data.grossAmount - withholdingTax - otherDeductions;

    const payment = this.paymentRepo.create({
      facilityId: data.facilityId,
      voucherNumber,
      supplierId: data.supplierId,
      purchaseOrderId: data.purchaseOrderId,
      paymentDate: data.paymentDate,
      grossAmount: data.grossAmount,
      withholdingTax,
      otherDeductions,
      netAmount,
      paymentMethod: data.paymentMethod,
      chequeNumber: data.chequeNumber,
      bankReference: data.bankReference,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      description: data.description,
      remarks: data.remarks,
      status: PaymentVoucherStatus.DRAFT,
      preparedBy: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Create items
    if (data.items?.length) {
      const items = data.items.map((item) =>
        this.paymentItemRepo.create({
          paymentId: (savedPayment as SupplierPayment).id,
          description: item.description,
          invoiceNumber: item.invoiceNumber,
          invoiceDate: item.invoiceDate,
          amount: item.amount,
          grnId: item.grnId,
        }),
      );
      await this.paymentItemRepo.save(items);
    }

    return this.getPaymentVoucher((savedPayment as SupplierPayment).id, tenantId);
  }

  async getPaymentVoucher(id: string, tenantId?: string): Promise<SupplierPayment> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const payment = await this.paymentRepo.findOne({
      where,
      relations: [
        'supplier',
        'purchaseOrder',
        'items',
        'preparedByUser',
        'approvedByUser',
        'paidByUser',
      ],
    });
    if (!payment) throw new NotFoundException('Payment voucher not found');
    return payment;
  }

  async listPaymentVouchers(
    facilityId: string,
    filters?: {
      status?: PaymentVoucherStatus;
      supplierId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    tenantId?: string,
  ): Promise<SupplierPayment[]> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .leftJoinAndSelect('p.items', 'items')
      .where('p.facilityId = :facilityId', { facilityId });

    if (filters?.status) {
      qb.andWhere('p.status = :status', { status: filters.status });
    }
    if (filters?.supplierId) {
      qb.andWhere('p.supplierId = :supplierId', { supplierId: filters.supplierId });
    }
    if (filters?.startDate && filters?.endDate) {
      qb.andWhere('p.paymentDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }
    if (tenantId) {
      qb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  async submitPaymentVoucher(id: string, tenantId?: string): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id, tenantId);
    if (payment.status !== PaymentVoucherStatus.DRAFT) {
      throw new BadRequestException('Only draft vouchers can be submitted');
    }
    payment.status = PaymentVoucherStatus.PENDING_APPROVAL;
    return this.paymentRepo.save(payment);
  }

  async approvePaymentVoucher(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id, tenantId);
    if (payment.status !== PaymentVoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending vouchers can be approved');
    }

    // Segregation of duties: approver cannot be the same as preparer
    if (payment.preparedBy === userId) {
      throw new BadRequestException(
        'Segregation of duties violation: the user who prepared the voucher cannot approve it',
      );
    }

    // Budget enforcement: check spending limit before approval
    const amount = Number(payment.grossAmount) || 0;
    if (amount > 0) {
      // Use Accounts Payable account for expense budget check
      const budgetCheck = await this.budgetService.checkBudgetAvailability(
        payment.facilityId,
        payment.supplierId, // accountId placeholder — in practice map to expense GL account
        amount,
        tenantId,
      );
      if (budgetCheck && !budgetCheck.withinBudget) {
        throw new BadRequestException(
          `Budget exceeded for "${budgetCheck.budgetName}": ` +
            `budgeted ${budgetCheck.budgetedAmount.toLocaleString()}, ` +
            `spent ${budgetCheck.actualSpent.toLocaleString()}, ` +
            `remaining ${budgetCheck.remainingBudget.toLocaleString()}, ` +
            `requested ${budgetCheck.pendingAmount.toLocaleString()}. ` +
            `Payment voucher ${payment.voucherNumber} cannot be approved.`,
        );
      }
    }

    payment.status = PaymentVoucherStatus.APPROVED;
    payment.approvedBy = userId;
    payment.approvedAt = new Date();
    return this.paymentRepo.save(payment);
  }

  async processPayment(
    id: string,
    userId: string,
    bankDetails?: {
      chequeNumber?: string;
      bankReference?: string;
    },
    tenantId?: string,
  ): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id, tenantId);
    if (payment.status !== PaymentVoucherStatus.APPROVED) {
      throw new BadRequestException('Only approved vouchers can be paid');
    }

    // Segregation of duties: payer cannot be the same as preparer or approver
    if (payment.preparedBy === userId) {
      throw new BadRequestException(
        'Segregation of duties violation: the user who prepared the voucher cannot process the payment',
      );
    }
    if (payment.approvedBy === userId) {
      throw new BadRequestException(
        'Segregation of duties violation: the user who approved the voucher cannot process the payment',
      );
    }

    if (bankDetails?.chequeNumber) {
      payment.chequeNumber = bankDetails.chequeNumber;
    }
    if (bankDetails?.bankReference) {
      payment.bankReference = bankDetails.bankReference;
    }

    payment.status = PaymentVoucherStatus.PAID;
    payment.paidBy = userId;
    payment.paidAt = new Date();
    const saved = await this.paymentRepo.save(payment);

    // Auto-post journal entry: AP DR, Cash/Bank CR
    await this.financeService.autoPostPaymentJournal({
      facilityId: payment.facilityId,
      paymentReference: payment.voucherNumber,
      amount: Number(payment.netAmount ?? payment.grossAmount) || 0,
      userId,
    });

    return saved;
  }

  async cancelPaymentVoucher(id: string, tenantId?: string): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id, tenantId);
    if (payment.status === PaymentVoucherStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid voucher');
    }
    payment.status = PaymentVoucherStatus.CANCELLED;
    return this.paymentRepo.save(payment);
  }

  // ==================== CREDIT/DEBIT NOTES ====================

  private async generateNoteNumber(facilityId: string, type: CreditNoteType): Promise<string> {
    const count = await this.creditNoteRepo.count({ where: { facilityId, noteType: type } });
    const date = new Date();
    const prefix = type === CreditNoteType.CREDIT_NOTE ? 'CN' : 'DN';
    return `${prefix}${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createCreditNote(
    data: {
      facilityId: string;
      noteType: CreditNoteType;
      supplierId: string;
      noteDate: Date;
      supplierInvoiceNumber?: string;
      grnId?: string;
      reason: CreditNoteReason;
      reasonDetails?: string;
      notes?: string;
      items: Array<{
        itemId?: string;
        description: string;
        quantity: number;
        unit?: string;
        unitPrice: number;
        taxRate?: number;
        batchNumber?: string;
      }>;
    },
    userId: string,
    tenantId?: string,
  ): Promise<SupplierCreditNote> {
    const noteNumber = await this.generateNoteNumber(data.facilityId, data.noteType);

    let subtotalAmount = 0;
    let taxAmount = 0;

    const itemsWithTotals = data.items.map((item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineTax = (lineSubtotal * (item.taxRate || 0)) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotalAmount += lineSubtotal;
      taxAmount += lineTax;

      return {
        ...item,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      };
    });

    const totalAmount = subtotalAmount + taxAmount;

    const creditNote = this.creditNoteRepo.create({
      facilityId: data.facilityId,
      noteNumber,
      noteType: data.noteType,
      supplierId: data.supplierId,
      noteDate: data.noteDate,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      grnId: data.grnId,
      reason: data.reason,
      reasonDetails: data.reasonDetails,
      subtotalAmount,
      taxAmount,
      totalAmount,
      appliedAmount: 0,
      balanceAmount: totalAmount,
      status: CreditNoteStatus.DRAFT,
      createdBy: userId,
      notes: data.notes,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedNote = await this.creditNoteRepo.save(creditNote);

    // Create items
    const items = itemsWithTotals.map((item) =>
      this.creditNoteItemRepo.create({
        creditNoteId: (savedNote as SupplierCreditNote).id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount,
        batchNumber: item.batchNumber,
      }),
    );
    await this.creditNoteItemRepo.save(items);

    return this.getCreditNote((savedNote as SupplierCreditNote).id, tenantId);
  }

  async getCreditNote(id: string, tenantId?: string): Promise<SupplierCreditNote> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const note = await this.creditNoteRepo.findOne({
      where,
      relations: ['supplier', 'items', 'createdByUser', 'approvedByUser'],
    });
    if (!note) throw new NotFoundException('Credit/Debit note not found');
    return note;
  }

  async listCreditNotes(
    facilityId: string,
    filters?: {
      noteType?: CreditNoteType;
      status?: CreditNoteStatus;
      supplierId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    tenantId?: string,
  ): Promise<SupplierCreditNote[]> {
    const qb = this.creditNoteRepo
      .createQueryBuilder('cn')
      .leftJoinAndSelect('cn.supplier', 'supplier')
      .leftJoinAndSelect('cn.items', 'items')
      .where('cn.facilityId = :facilityId', { facilityId });

    if (filters?.noteType) {
      qb.andWhere('cn.noteType = :noteType', { noteType: filters.noteType });
    }
    if (filters?.status) {
      qb.andWhere('cn.status = :status', { status: filters.status });
    }
    if (filters?.supplierId) {
      qb.andWhere('cn.supplierId = :supplierId', { supplierId: filters.supplierId });
    }
    if (filters?.startDate && filters?.endDate) {
      qb.andWhere('cn.noteDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }
    if (tenantId) {
      qb.andWhere('cn.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('cn.createdAt', 'DESC').getMany();
  }

  async approveCreditNote(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(id, tenantId);
    if (
      note.status !== CreditNoteStatus.DRAFT &&
      note.status !== CreditNoteStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException('Note cannot be approved from current status');
    }
    note.status = CreditNoteStatus.APPROVED;
    note.approvedBy = userId;
    note.approvedAt = new Date();
    return this.creditNoteRepo.save(note);
  }

  async applyCreditNote(
    creditNoteId: string,
    paymentVoucherId: string,
    amount: number,
    tenantId?: string,
  ): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(creditNoteId, tenantId);
    if (note.status !== CreditNoteStatus.APPROVED) {
      throw new BadRequestException('Only approved notes can be applied');
    }
    if (amount > Number(note.balanceAmount)) {
      throw new BadRequestException('Amount exceeds available balance');
    }

    note.appliedAmount = Number(note.appliedAmount) + amount;
    note.balanceAmount = Number(note.balanceAmount) - amount;

    if (Number(note.balanceAmount) <= 0) {
      note.status = CreditNoteStatus.APPLIED;
    }

    return this.creditNoteRepo.save(note);
  }

  async cancelCreditNote(id: string, tenantId?: string): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(id, tenantId);
    if (note.status === CreditNoteStatus.APPLIED) {
      throw new BadRequestException('Cannot cancel an applied note');
    }
    note.status = CreditNoteStatus.CANCELLED;
    return this.creditNoteRepo.save(note);
  }

  // ==================== REPORTS ====================

  async getSupplierLedger(
    supplierId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<{
    supplier: Supplier;
    openingBalance: number;
    transactions: Array<{
      date: Date;
      type: string;
      reference: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    closingBalance: number;
  }> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const transactions: Array<{
      date: Date;
      type: string;
      reference: string;
      debit: number;
      credit: number;
      balance: number;
    }> = [];

    // Get GRNs (increases payable)
    const grns = await this.grnRepo.find({
      where: {
        supplierId,
        postedAt: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { postedAt: 'ASC' },
    });

    for (const grn of grns) {
      transactions.push({
        date: grn.postedAt!,
        type: 'GRN',
        reference: grn.grnNumber,
        debit: 0,
        credit: Number(grn.totalValue),
        balance: 0, // Will calculate below
      });
    }

    // Get payments (decreases payable)
    const payments = await this.paymentRepo.find({
      where: {
        supplierId,
        status: PaymentVoucherStatus.PAID,
        paidAt: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { paidAt: 'ASC' },
    });

    for (const payment of payments) {
      transactions.push({
        date: payment.paidAt!,
        type: 'Payment',
        reference: payment.voucherNumber,
        debit: Number(payment.netAmount),
        credit: 0,
        balance: 0,
      });
    }

    // Get credit notes (decreases payable)
    const creditNotes = await this.creditNoteRepo.find({
      where: {
        supplierId,
        noteType: CreditNoteType.CREDIT_NOTE,
        status: CreditNoteStatus.APPROVED,
        approvedAt: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { approvedAt: 'ASC' },
    });

    for (const cn of creditNotes) {
      transactions.push({
        date: cn.approvedAt!,
        type: 'Credit Note',
        reference: cn.noteNumber,
        debit: Number(cn.totalAmount),
        credit: 0,
        balance: 0,
      });
    }

    // Get debit notes (increases payable)
    const debitNotes = await this.creditNoteRepo.find({
      where: {
        supplierId,
        noteType: CreditNoteType.DEBIT_NOTE,
        status: CreditNoteStatus.APPROVED,
        approvedAt: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { approvedAt: 'ASC' },
    });

    for (const dn of debitNotes) {
      transactions.push({
        date: dn.approvedAt!,
        type: 'Debit Note',
        reference: dn.noteNumber,
        debit: 0,
        credit: Number(dn.totalAmount),
        balance: 0,
      });
    }

    // Sort by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let balance = 0; // TODO: Get opening balance from previous period
    for (const txn of transactions) {
      balance = balance - txn.debit + txn.credit;
      txn.balance = balance;
    }

    return {
      supplier,
      openingBalance: 0,
      transactions,
      closingBalance: balance,
    };
  }

  async getSupplierAgingReport(
    facilityId: string,
    tenantId?: string,
  ): Promise<{
    suppliers: Array<{
      supplierId: string;
      supplierName: string;
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    }>;
    totals: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    };
  }> {
    const suppliers = await this.supplierRepo.find({
      where: { status: SupplierStatus.ACTIVE, ...(tenantId ? { tenantId } : {}) },
    });
    const today = new Date();

    const agingData: Array<{
      supplierId: string;
      supplierName: string;
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    }> = [];

    const totals = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

    for (const supplier of suppliers) {
      // Get unpaid GRNs
      const grns = await this.grnRepo.find({
        where: {
          facilityId,
          supplierId: supplier.id,
          status: GRNStatus.POSTED,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      // Get payments
      const payments = await this.paymentRepo.find({
        where: {
          facilityId,
          supplierId: supplier.id,
          status: PaymentVoucherStatus.PAID,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      const totalGRN = grns.reduce((sum, g) => sum + Number(g.totalValue), 0);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.netAmount), 0);
      const outstanding = totalGRN - totalPaid;

      if (outstanding <= 0) continue;

      // Simplified aging - in real implementation, track per invoice
      const supplierData = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
        total: outstanding,
      };

      // Distribute outstanding based on GRN ages
      for (const grn of grns) {
        const daysDiff = Math.floor(
          (today.getTime() - grn.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const grnAmount = Number(grn.totalValue);

        if (daysDiff <= 30) {
          supplierData.current += grnAmount;
        } else if (daysDiff <= 60) {
          supplierData.days30 += grnAmount;
        } else if (daysDiff <= 90) {
          supplierData.days60 += grnAmount;
        } else if (daysDiff <= 120) {
          supplierData.days90 += grnAmount;
        } else {
          supplierData.over90 += grnAmount;
        }
      }

      agingData.push(supplierData);

      totals.current += supplierData.current;
      totals.days30 += supplierData.days30;
      totals.days60 += supplierData.days60;
      totals.days90 += supplierData.days90;
      totals.over90 += supplierData.over90;
      totals.total += supplierData.total;
    }

    return { suppliers: agingData, totals };
  }

  async getPaymentSummary(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<{
    totalVouchers: number;
    totalPaid: number;
    totalPending: number;
    byPaymentMethod: Record<string, number>;
    bySupplier: Array<{ supplierId: string; supplierName: string; amount: number }>;
  }> {
    const payments = await this.paymentRepo.find({
      where: {
        facilityId,
        paymentDate: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['supplier'],
    });

    const byPaymentMethod: Record<string, number> = {};
    const supplierMap = new Map<string, { name: string; amount: number }>();
    let totalPaid = 0;
    let totalPending = 0;

    for (const payment of payments) {
      const amount = Number(payment.netAmount);

      if (payment.status === PaymentVoucherStatus.PAID) {
        totalPaid += amount;
        byPaymentMethod[payment.paymentMethod] =
          (byPaymentMethod[payment.paymentMethod] || 0) + amount;

        const existing = supplierMap.get(payment.supplierId) || {
          name: payment.supplier?.name || '',
          amount: 0,
        };
        existing.amount += amount;
        supplierMap.set(payment.supplierId, existing);
      } else if (payment.status !== PaymentVoucherStatus.CANCELLED) {
        totalPending += amount;
      }
    }

    const bySupplier = Array.from(supplierMap.entries()).map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      amount: data.amount,
    }));

    return {
      totalVouchers: payments.length,
      totalPaid,
      totalPending,
      byPaymentMethod,
      bySupplier,
    };
  }

  // ============ DEBIT NOTE FROM GRN REJECTIONS ============

  async previewDebitNoteFromGRN(grnId: string, tenantId?: string): Promise<{
    grnNumber: string;
    grnId: string;
    supplierId: string;
    supplierName: string;
    facilityId: string;
    rejectedItems: Array<{
      itemId?: string;
      description: string;
      quantityRejected: number;
      unit?: string;
      unitCost: number;
      lineTotal: number;
      batchNumber?: string;
      rejectionReason?: string;
    }>;
    existingDebitNotes: Array<{ id: string; noteNumber: string; status: string; totalAmount: number }>;
    totalRejectedValue: number;
    canCreate: boolean;
    blockReason?: string;
  }> {
    const grn = await this.grnRepo.findOne({
      where: { id: grnId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'items.item', 'supplier', 'purchaseOrder'],
    });
    if (!grn) throw new NotFoundException('GRN not found');

    const rejectedLines = (grn.items || []).filter((it) => Number(it.quantityRejected || 0) > 0);

    const supplierId = grn.supplier?.id || (grn as any).supplierId || (grn.purchaseOrder as any)?.supplierId;
    const supplierName = grn.supplier?.name || (grn.purchaseOrder as any)?.supplier?.name || 'Unknown';

    const existing = await this.creditNoteRepo.find({
      where: { grnId, noteType: CreditNoteType.DEBIT_NOTE, ...(tenantId ? { tenantId } : {}) },
      select: ['id', 'noteNumber', 'status', 'totalAmount'],
    });

    const rejectedItems = rejectedLines.map((it: any) => ({
      itemId: it.itemId || it.item?.id,
      description: it.item?.name || it.itemName || 'Item',
      quantityRejected: Number(it.quantityRejected),
      unit: it.item?.unit,
      unitCost: Number(it.unitCost || 0),
      lineTotal: Number(it.quantityRejected) * Number(it.unitCost || 0),
      batchNumber: it.batchNumber,
      rejectionReason: it.rejectionReason,
    }));

    const totalRejectedValue = rejectedItems.reduce((s, it) => s + it.lineTotal, 0);

    let canCreate = true;
    let blockReason: string | undefined;
    if (rejectedItems.length === 0) {
      canCreate = false;
      blockReason = 'GRN has no rejected items';
    } else if (!supplierId) {
      canCreate = false;
      blockReason = 'GRN has no supplier linkage';
    } else {
      const openExisting = existing.filter((n) => n.status !== CreditNoteStatus.CANCELLED);
      if (openExisting.length > 0) {
        canCreate = false;
        blockReason = `A debit note already exists for this GRN (${openExisting[0].noteNumber}, ${openExisting[0].status})`;
      }
    }

    return {
      grnNumber: grn.grnNumber,
      grnId: grn.id,
      supplierId,
      supplierName,
      facilityId: grn.facilityId,
      rejectedItems,
      existingDebitNotes: existing.map((n) => ({
        id: n.id,
        noteNumber: n.noteNumber,
        status: n.status,
        totalAmount: Number(n.totalAmount),
      })),
      totalRejectedValue,
      canCreate,
      blockReason,
    };
  }

  async createDebitNoteFromGRN(
    grnId: string,
    opts: { reason?: CreditNoteReason; reasonDetails?: string; notes?: string },
    userId: string,
    tenantId?: string,
  ): Promise<SupplierCreditNote> {
    const preview = await this.previewDebitNoteFromGRN(grnId, tenantId);
    if (!preview.canCreate) {
      throw new BadRequestException(preview.blockReason || 'Cannot create debit note from this GRN');
    }

    const reason = opts.reason || this.inferReasonFromRejection(preview.rejectedItems[0]?.rejectionReason);

    return this.createCreditNote(
      {
        facilityId: preview.facilityId,
        noteType: CreditNoteType.DEBIT_NOTE,
        supplierId: preview.supplierId,
        noteDate: new Date(),
        grnId,
        reason,
        reasonDetails:
          opts.reasonDetails ||
          preview.rejectedItems
            .filter((i) => i.rejectionReason)
            .map((i) => `${i.description}: ${i.rejectionReason}`)
            .join('; ') ||
          'Rejected items from GRN',
        notes: opts.notes || `Auto-generated from GRN ${preview.grnNumber}`,
        items: preview.rejectedItems.map((it) => ({
          itemId: it.itemId,
          description: it.description,
          quantity: it.quantityRejected,
          unit: it.unit,
          unitPrice: it.unitCost,
          batchNumber: it.batchNumber,
        })),
      },
      userId,
      tenantId,
    );
  }

  private inferReasonFromRejection(rejectionReason?: string): CreditNoteReason {
    if (!rejectionReason) return CreditNoteReason.QUALITY_ISSUE;
    const r = rejectionReason.toLowerCase();
    if (r.includes('damag')) return CreditNoteReason.DAMAGED_GOODS;
    if (r.includes('expir')) return CreditNoteReason.EXPIRED_GOODS;
    if (r.includes('quantity') || r.includes('short') || r.includes('over')) return CreditNoteReason.QUANTITY_DISCREPANCY;
    if (r.includes('price') || r.includes('overcharge')) return CreditNoteReason.PRICING_ERROR;
    if (r.includes('return')) return CreditNoteReason.GOODS_RETURNED;
    return CreditNoteReason.QUALITY_ISSUE;
  }
}
