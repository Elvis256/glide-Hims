import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) {}

  // ==================== SUPPLIER PAYMENTS ====================

  private async generateVoucherNumber(facilityId: string): Promise<string> {
    const count = await this.paymentRepo.count({ where: { facilityId } });
    const date = new Date();
    return `PV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createPaymentVoucher(data: {
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
  }, userId: string): Promise<SupplierPayment> {
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
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Create items
    if (data.items?.length) {
      const items = data.items.map(item => this.paymentItemRepo.create({
        paymentId: (savedPayment as SupplierPayment).id,
        description: item.description,
        invoiceNumber: item.invoiceNumber,
        invoiceDate: item.invoiceDate,
        amount: item.amount,
        grnId: item.grnId,
      }));
      await this.paymentItemRepo.save(items);
    }

    return this.getPaymentVoucher((savedPayment as SupplierPayment).id);
  }

  async getPaymentVoucher(id: string): Promise<SupplierPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['supplier', 'purchaseOrder', 'items', 'preparedByUser', 'approvedByUser', 'paidByUser'],
    });
    if (!payment) throw new NotFoundException('Payment voucher not found');
    return payment;
  }

  async listPaymentVouchers(facilityId: string, filters?: {
    status?: PaymentVoucherStatus;
    supplierId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SupplierPayment[]> {
    const qb = this.paymentRepo.createQueryBuilder('p')
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

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  async submitPaymentVoucher(id: string): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id);
    if (payment.status !== PaymentVoucherStatus.DRAFT) {
      throw new BadRequestException('Only draft vouchers can be submitted');
    }
    payment.status = PaymentVoucherStatus.PENDING_APPROVAL;
    return this.paymentRepo.save(payment);
  }

  async approvePaymentVoucher(id: string, userId: string): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id);
    if (payment.status !== PaymentVoucherStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only pending vouchers can be approved');
    }
    payment.status = PaymentVoucherStatus.APPROVED;
    payment.approvedBy = userId;
    payment.approvedAt = new Date();
    return this.paymentRepo.save(payment);
  }

  async processPayment(id: string, userId: string, bankDetails?: {
    chequeNumber?: string;
    bankReference?: string;
  }): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id);
    if (payment.status !== PaymentVoucherStatus.APPROVED) {
      throw new BadRequestException('Only approved vouchers can be paid');
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
    return this.paymentRepo.save(payment);
  }

  async cancelPaymentVoucher(id: string): Promise<SupplierPayment> {
    const payment = await this.getPaymentVoucher(id);
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

  async createCreditNote(data: {
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
  }, userId: string): Promise<SupplierCreditNote> {
    const noteNumber = await this.generateNoteNumber(data.facilityId, data.noteType);

    let subtotalAmount = 0;
    let taxAmount = 0;

    const itemsWithTotals = data.items.map(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineTax = lineSubtotal * (item.taxRate || 0) / 100;
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
    });

    const savedNote = await this.creditNoteRepo.save(creditNote);

    // Create items
    const items = itemsWithTotals.map(item => this.creditNoteItemRepo.create({
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
    }));
    await this.creditNoteItemRepo.save(items);

    return this.getCreditNote((savedNote as SupplierCreditNote).id);
  }

  async getCreditNote(id: string): Promise<SupplierCreditNote> {
    const note = await this.creditNoteRepo.findOne({
      where: { id },
      relations: ['supplier', 'items', 'createdByUser', 'approvedByUser'],
    });
    if (!note) throw new NotFoundException('Credit/Debit note not found');
    return note;
  }

  async listCreditNotes(facilityId: string, filters?: {
    noteType?: CreditNoteType;
    status?: CreditNoteStatus;
    supplierId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SupplierCreditNote[]> {
    const qb = this.creditNoteRepo.createQueryBuilder('cn')
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

    return qb.orderBy('cn.createdAt', 'DESC').getMany();
  }

  async approveCreditNote(id: string, userId: string): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(id);
    if (note.status !== CreditNoteStatus.DRAFT && note.status !== CreditNoteStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Note cannot be approved from current status');
    }
    note.status = CreditNoteStatus.APPROVED;
    note.approvedBy = userId;
    note.approvedAt = new Date();
    return this.creditNoteRepo.save(note);
  }

  async applyCreditNote(creditNoteId: string, paymentVoucherId: string, amount: number): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(creditNoteId);
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

  async cancelCreditNote(id: string): Promise<SupplierCreditNote> {
    const note = await this.getCreditNote(id);
    if (note.status === CreditNoteStatus.APPLIED) {
      throw new BadRequestException('Cannot cancel an applied note');
    }
    note.status = CreditNoteStatus.CANCELLED;
    return this.creditNoteRepo.save(note);
  }

  // ==================== REPORTS ====================

  async getSupplierLedger(supplierId: string, startDate: Date, endDate: Date): Promise<{
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
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
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

  async getSupplierAgingReport(facilityId: string): Promise<{
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
    const suppliers = await this.supplierRepo.find({ where: { status: SupplierStatus.ACTIVE } });
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
        },
      });

      // Get payments
      const payments = await this.paymentRepo.find({
        where: {
          facilityId,
          supplierId: supplier.id,
          status: PaymentVoucherStatus.PAID,
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
        const daysDiff = Math.floor((today.getTime() - grn.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
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

  async getPaymentSummary(facilityId: string, startDate: Date, endDate: Date): Promise<{
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
        byPaymentMethod[payment.paymentMethod] = (byPaymentMethod[payment.paymentMethod] || 0) + amount;

        const existing = supplierMap.get(payment.supplierId) || { name: payment.supplier?.name || '', amount: 0 };
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
}
