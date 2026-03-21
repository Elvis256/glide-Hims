import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Invoice, InvoiceItem, Payment, InvoiceStatus, PaymentStatus } from '../../database/entities/invoice.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { Queue, QueueStatus } from '../../database/entities/queue.entity';
import { CreateInvoiceDto, AddInvoiceItemDto, CreatePaymentDto, InvoiceQueryDto } from './billing.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { FinanceService } from '../finance/finance.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { CoverageCheckService } from '../insurance/coverage-check.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private itemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private settingsService: SystemSettingsService,
    private financeService: FinanceService,
    private pricingEngineService: PricingEngineService,
    private coverageCheckService: CoverageCheckService,
  ) {}

  private async generateInvoiceNumber(tenantId?: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const today = new Date();
      const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

      // Advisory lock prevents concurrent duplicate invoice numbers
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`INV${datePrefix}${tenantId || ''}`]);

      const result = await manager.query(
        `SELECT invoice_number FROM invoices
         WHERE invoice_number LIKE $1
         ${tenantId ? 'AND tenant_id = $2' : ''}
         ORDER BY invoice_number DESC LIMIT 1`,
        tenantId ? [`INV${datePrefix}%`, tenantId] : [`INV${datePrefix}%`],
      );

      let sequence = 1;
      if (result.length > 0) {
        const lastSeq = parseInt(result[0].invoice_number.slice(-4), 10);
        sequence = lastSeq + 1;
      }

      return `INV${datePrefix}${sequence.toString().padStart(4, '0')}`;
    });
  }

  private async generateReceiptNumber(tenantId?: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const today = new Date();
      const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

      // Advisory lock prevents concurrent duplicate receipt numbers
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`RCP${datePrefix}${tenantId || ''}`]);

      const result = await manager.query(
        `SELECT receipt_number FROM payments 
         WHERE receipt_number LIKE $1 
         ${tenantId ? 'AND tenant_id = $2' : ''}
         ORDER BY receipt_number DESC LIMIT 1`,
        tenantId ? [`RCP${datePrefix}%`, tenantId] : [`RCP${datePrefix}%`],
      );

      let sequence = 1;
      if (result.length > 0) {
        const lastSeq = parseInt(result[0].receipt_number.slice(-4), 10);
        sequence = lastSeq + 1;
      }

      return `RCP${datePrefix}${sequence.toString().padStart(4, '0')}`;
    });
  }

  async createInvoice(dto: CreateInvoiceDto, userId: string, tenantId?: string): Promise<Invoice> {
    // Validate no negative amounts
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(`Item quantity must be positive: ${item.description || 'unknown item'}`);
      }
      if (item.unitPrice <= 0) {
        throw new BadRequestException(`Unit price must be positive: ${item.description || 'unknown item'}`);
      }
    }
    if (dto.discountAmount && dto.discountAmount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }

    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    // Calculate totals from items
    let subtotal = 0;
    const items = dto.items.map(item => {
      const amount = item.quantity * item.unitPrice;
      subtotal += amount;
      return this.itemRepository.create({
        ...item,
        amount,
      });
    });

    const taxAmount = dto.taxPercent ? (subtotal * dto.taxPercent / 100) : (subtotal * 18 / 100);
    const taxPercent = dto.taxPercent ?? 18;
    const discountAmount = dto.discountAmount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      createdById: userId,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      balanceDue: totalAmount,
      notes: dto.notes,
      dueDate: dto.dueDate,
      paymentType: dto.paymentType,
      insurancePolicyId: dto.insurancePolicyId,
      items,
      ...(tenantId ? { tenantId } : {}),
    });

    const saved = await this.invoiceRepository.save(invoice);

    // Auto-post to General Ledger: DR Accounts Receivable, CR Revenue
    if (dto.encounterId) {
      const encounter = await this.encounterRepository.findOne({
        where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
      });
      if (encounter?.facilityId) {
        this.financeService.autoPostInvoiceJournal({
          facilityId: encounter.facilityId,
          invoiceNumber: invoiceNumber,
          totalAmount: totalAmount,
          revenueCategory: dto.paymentType || 'consultation',
          userId,
        }, tenantId).catch(err => this.logger.error(`GL auto-post failed for ${invoiceNumber}: ${err.message}`, { invoiceNumber, totalAmount, error: err.stack }));
      }
      // Update encounter status if linked
      if (encounter && encounter.status === EncounterStatus.PENDING_PHARMACY) {
        encounter.status = EncounterStatus.PENDING_PAYMENT;
        await this.encounterRepository.save(encounter);
      }
    }

    return this.findInvoice(saved.id, tenantId);
  }

  async findAll(query: InvoiceQueryDto, tenantId?: string): Promise<{ data: Invoice[]; total: number }> {
    const { status, patientId, encounterId, dateFrom, dateTo, search, patientMrn, page = 1, limit = 20 } = query;

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('invoice.payments', 'payments');

    if (tenantId) {
      qb.andWhere('(invoice.tenant_id = :tenantId OR invoice.tenant_id IS NULL)', { tenantId });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    if (patientId) {
      qb.andWhere('invoice.patient_id = :patientId', { patientId });
    }

    if (encounterId) {
      qb.andWhere('invoice.encounter_id = :encounterId', { encounterId });
    }

    if (dateFrom) {
      qb.andWhere('invoice.created_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('invoice.created_at <= :dateTo', { dateTo });
    }

    // Search by patient name, MRN, or invoice number
    if (search) {
      qb.andWhere(
        '(patient.full_name ILIKE :search OR patient.mrn ILIKE :search OR invoice.invoice_number ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Search by patient MRN specifically
    if (patientMrn) {
      qb.andWhere('patient.mrn ILIKE :patientMrn', { patientMrn: `%${patientMrn}%` });
    }

    qb.orderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findInvoice(id: string, tenantId?: string): Promise<Invoice> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string, tenantId?: string): Promise<Invoice> {
    const where: any = { invoiceNumber };
    if (tenantId) where.tenantId = tenantId;
    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['items', 'payments', 'patient'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async addItem(invoiceId: string, dto: AddInvoiceItemDto, userId?: string, tenantId?: string): Promise<Invoice> {
    const invoice = await this.findInvoice(invoiceId, tenantId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot add items to a paid invoice');
    }

    const amount = dto.quantity * dto.unitPrice;
    const item = this.itemRepository.create({
      ...dto,
      invoiceId,
      amount,
    });

    await this.itemRepository.save(item);

    this.logger.log(`Invoice item added to ${invoiceId} by ${userId || 'unknown'}: ${dto.description || dto.serviceCode || 'item'} amount=${amount}`);

    // Recalculate invoice totals
    return this.recalculateInvoice(invoiceId, tenantId);
  }

  async updateItemPrice(invoiceId: string, itemId: string, unitPrice: number, userId?: string, tenantId?: string): Promise<Invoice> {
    const invoice = await this.findInvoice(invoiceId, tenantId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot update items on a paid invoice');
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, invoiceId },
    });
    if (!item) {
      throw new NotFoundException('Invoice item not found');
    }

    item.unitPrice = unitPrice;
    item.amount = item.quantity * unitPrice;
    await this.itemRepository.save(item);

    this.logger.log(`Invoice item ${itemId} price updated to ${unitPrice} on ${invoiceId} by ${userId || 'unknown'}`);

    return this.recalculateInvoice(invoiceId, tenantId);
  }

  async removeItemById(invoiceId: string, itemId: string, userId?: string, tenantId?: string): Promise<Invoice> {
    const invoice = await this.findInvoice(invoiceId, tenantId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot remove items from a paid invoice');
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, invoiceId },
    });
    if (!item) {
      throw new NotFoundException('Invoice item not found');
    }

    await this.itemRepository.remove(item);
    this.logger.log(`Invoice item ${itemId} (${item.description}) removed from ${invoiceId} by ${userId || 'unknown'}`);

    return this.recalculateInvoice(invoiceId, tenantId);
  }

  private async recalculateInvoice(invoiceId: string, tenantId?: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const where: any = { id: invoiceId };
      if (tenantId) where.tenantId = tenantId;

      // Lock the invoice row first (no nullable relations to avoid FOR UPDATE on outer joins)
      await manager.findOne(Invoice, {
        where,
        lock: { mode: 'pessimistic_write' },
      });

      // Then load with all relations (no lock)
      const invoice = await manager.findOne(Invoice, {
        where,
        relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
      const totalAmount = subtotal + Number(invoice.taxAmount) - Number(invoice.discountAmount);
      const balanceDue = totalAmount - Number(invoice.amountPaid);

      // Calculate insurance breakdown
      const insuranceAmount = invoice.items.reduce((sum, item) => sum + Number(item.insuranceAmount || 0), 0);
      const copayAmount = invoice.items.reduce((sum, item) => sum + Number(item.copayAmount || 0), 0);
      // Patient pays: copay on covered items + full amount on uncovered items
      const uncoveredAmount = invoice.items
        .filter(item => !item.insuranceCovered)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const patientResponsibility = copayAmount + uncoveredAmount;

      invoice.subtotal = subtotal;
      invoice.totalAmount = totalAmount;
      invoice.balanceDue = balanceDue;
      invoice.insuranceAmount = insuranceAmount;
      invoice.copayAmount = copayAmount;
      invoice.patientResponsibility = patientResponsibility;

      // Update status based on payments
      if (balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
      } else if (Number(invoice.amountPaid) > 0) {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      return manager.save(Invoice, invoice);
    });
  }

  async recordPayment(dto: CreatePaymentDto, userId: string, tenantId?: string): Promise<Payment> {
    // Use transaction to prevent race conditions when multiple payments hit simultaneously
    return this.dataSource.transaction(async (manager) => {
      // Lock the invoice row for update to prevent concurrent payment issues
      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoiceId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Invoice is already fully paid');
      }

      if (dto.amount > Number(invoice.balanceDue)) {
        throw new BadRequestException(`Payment amount exceeds balance due (${invoice.balanceDue})`);
      }

      // Block payment if any items have zero prices
      const items = await manager.find(InvoiceItem, { where: { invoiceId: dto.invoiceId } });
      const zeroPriceItems = items.filter(i => !i.unitPrice || Number(i.unitPrice) <= 0);
      if (zeroPriceItems.length > 0) {
        const names = zeroPriceItems.map(i => i.description).join(', ');
        throw new BadRequestException(`Cannot process payment: the following items have no price set: ${names}. Please update prices first.`);
      }

      const receiptNumber = await this.generateReceiptNumber(tenantId);

      const payment = manager.create(Payment, {
        receiptNumber,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        transactionReference: dto.transactionReference,
        notes: dto.notes,
        receivedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      // Prevent duplicate payment with same transaction reference
      if (dto.transactionReference) {
        const existing = await manager.findOne(Payment, {
          where: { transactionReference: dto.transactionReference, ...(tenantId ? { tenantId } : {}) },
        });
        if (existing) {
          throw new BadRequestException(`Duplicate payment: transaction reference '${dto.transactionReference}' already exists on receipt ${existing.receiptNumber}`);
        }
      }

      const savedPayment = await manager.save(payment);

      // Update invoice totals
      invoice.amountPaid = Number(invoice.amountPaid) + dto.amount;
      invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

      let invoiceFullyPaid = false;
      if (invoice.balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
        invoiceFullyPaid = true;

        // Advance queue: if patient is in PENDING_PAYMENT, move to WAITING
        if (invoice.encounterId) {
          const queueEntry = await manager.findOne(Queue, {
            where: {
              encounterId: invoice.encounterId,
              status: QueueStatus.PENDING_PAYMENT,
            },
          });
          if (queueEntry) {
            await manager.update(Queue, { id: queueEntry.id }, {
              status: QueueStatus.WAITING,
            });
            this.logger.log(`Queue ${queueEntry.ticketNumber} advanced from PENDING_PAYMENT to WAITING after payment ${receiptNumber}`);
          }

          // If encounter is in PENDING_PAYMENT status (post-consultation), complete it
          // Only complete if ALL invoices for this encounter are paid
          const encounter = await manager.findOne(Encounter, { where: { id: invoice.encounterId } });
          if (encounter && encounter.status === EncounterStatus.PENDING_PAYMENT) {
            const remainingUnpaid = await manager
              .createQueryBuilder(Invoice, 'inv')
              .where('inv.encounter_id = :encounterId', { encounterId: invoice.encounterId })
              .andWhere('inv.id != :thisId', { thisId: invoice.id })
              .andWhere('inv.status NOT IN (:...terminal)', { terminal: ['paid', 'cancelled', 'refunded'] })
              .andWhere('inv.balance_due > 0')
              .getCount();
            if (remainingUnpaid === 0) {
              await manager.update(Encounter, { id: invoice.encounterId }, {
                status: EncounterStatus.COMPLETED,
                endTime: new Date(),
              });
            }
          }
        }
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      await manager.update(Invoice, { id: invoice.id }, {
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        status: invoice.status,
      });

      // Load full invoice with relations for GL posting and notifications
      const fullInvoice = await manager.findOne(Invoice, {
        where: { id: invoice.id, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'encounter'],
      });

      // Auto-post to General Ledger: DR Cash/Bank, CR Accounts Receivable
      const facilityForGL = fullInvoice?.encounter?.facilityId;
      if (facilityForGL) {
        this.financeService.autoPostPatientPaymentJournal({
          facilityId: facilityForGL,
          receiptNumber,
          amount: dto.amount,
          paymentMethod: dto.method || 'cash',
          userId,
        }, tenantId).catch(err => this.logger.error(`GL auto-post failed for payment ${receiptNumber}: ${err.message}`, { receiptNumber, amount: dto.amount, error: err.stack }));
      }

      // Send thank you SMS/Email after full payment (non-blocking)
      if (invoiceFullyPaid && invoice.patientId && fullInvoice?.patient) {
        const patientName = fullInvoice.patient.fullName;
        const facilityId = fullInvoice.encounter?.facilityId;
        if (facilityId) {
          this.notificationsService
            .sendThankYouMessage(facilityId, invoice.patientId, patientName, receiptNumber)
            .then(result => {
              if (result.success) {
                this.logger.log(`Thank you message sent to ${patientName} via ${result.channel}`);
              }
            })
            .catch(err => this.logger.warn(`Thank you message failed: ${err.message}`));
        }
      }

      return savedPayment;
    });
  }

  async getPaymentsByInvoice(invoiceId: string, tenantId?: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId , ...(tenantId ? { tenantId } : {}) },
      order: { paidAt: 'DESC' },
      relations: ['receivedBy'],
    });
  }

  async listPayments(params: { startDate?: string; endDate?: string; method?: string }, tenantId?: string): Promise<Payment[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('payment.receivedBy', 'receivedBy');

    if (tenantId) {
      qb.andWhere('invoice.tenant_id = :tenantId', { tenantId });
    }

    if (params.startDate) {
      const startDate = new Date(params.startDate);
      startDate.setHours(0, 0, 0, 0);
      qb.andWhere('payment.paid_at >= :startDate', { startDate });
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      qb.andWhere('payment.paid_at <= :endDate', { endDate });
    }

    if (params.method) {
      qb.andWhere('payment.method = :method', { method: params.method });
    }

    qb.orderBy('payment.paidAt', 'DESC');

    const payments = await qb.getMany();

    // Transform to include patient info
    return payments.map(p => ({
      ...p,
      patientName: p.invoice?.patient?.fullName || null,
    }));
  }

  async voidPayment(paymentId: string, reason: string, userId: string, tenantId?: string): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const invoiceRepo = manager.getRepository(Invoice);

      // Lock payment to prevent concurrent void
      const payment = await paymentRepo.findOne({
        where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
        relations: ['invoice', 'invoice.encounter'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestException('Payment is already voided');
      }

      // Maker-checker: the user who received the payment cannot void it
      if (payment.receivedById === userId) {
        throw new BadRequestException('Segregation of duties violation: the payment receiver cannot void their own payment');
      }

      // Void the payment
      payment.status = PaymentStatus.VOIDED;
      payment.notes = `${payment.notes || ''}\nVoided by ${userId}: ${reason}`.trim();

      await paymentRepo.save(payment);

      // Recalculate invoice totals atomically
      if (payment.invoice) {
        const invoice = await invoiceRepo.findOne({
          where: { id: payment.invoice.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (invoice) {
          invoice.amountPaid = Number(invoice.amountPaid) - Number(payment.amount);
          invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

          if (invoice.amountPaid <= 0) {
            invoice.status = InvoiceStatus.PENDING;
          } else if (invoice.balanceDue > 0) {
            invoice.status = InvoiceStatus.PARTIALLY_PAID;
          }

          await invoiceRepo.save(invoice);
        }

        // Post GL reversal: DR Accounts Receivable, CR Cash (reverses the original payment posting)
        const facilityId = payment.invoice.encounter?.facilityId;
        if (facilityId && Number(payment.amount) > 0) {
          this.financeService.autoPostPatientPaymentJournal({
            facilityId,
            receiptNumber: `${payment.receiptNumber}-VOID`,
            amount: -Number(payment.amount),
            paymentMethod: payment.method || 'cash',
            userId,
          }, tenantId).catch(err => this.logger.error(`GL reversal failed for voided payment ${payment.receiptNumber}: ${err.message}`, { receiptNumber: payment.receiptNumber, amount: payment.amount, error: err.stack }));
        }
      }

      return payment;
    });
  }

  async getPayment(paymentId: string, tenantId?: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId , ...(tenantId ? { tenantId } : {}) },
      relations: ['invoice', 'invoice.items', 'invoice.patient', 'receivedBy'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getDailyRevenue(date: Date = new Date(), tenantId?: string): Promise<{
    totalCollected: number;
    cashAmount: number;
    mobileMoneyAmount: number;
    cardAmount: number;
    paymentCount: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.paid_at BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED });

    if (tenantId) {
      qb.leftJoin('payment.invoice', 'invoice')
        .andWhere('invoice.tenant_id = :tenantId', { tenantId });
    }

    const payments = await qb.getMany();

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const cashAmount = payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0);
    const mobileMoneyAmount = payments.filter(p => p.method === 'mobile_money').reduce((sum, p) => sum + Number(p.amount), 0);
    const cardAmount = payments.filter(p => p.method === 'card').reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      totalCollected,
      cashAmount,
      mobileMoneyAmount,
      cardAmount,
      paymentCount: payments.length,
    };
  }

  async getPendingInvoices(tenantId?: string): Promise<Invoice[]> {
    const where: any[] = [
      { status: InvoiceStatus.PENDING },
      { status: InvoiceStatus.PARTIALLY_PAID },
    ];
    if (tenantId) {
      where[0].tenantId = tenantId;
      where[1].tenantId = tenantId;
    }
    return this.invoiceRepository.find({
      where,
      relations: ['patient', 'items'],
      order: { createdAt: 'ASC' },
    });
  }

  async cancelInvoice(id: string, reason?: string, userId?: string, tenantId?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['patient', 'encounter'],
    });
    
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice. Use refund instead.');
    }
    
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already cancelled');
    }
    
    invoice.status = InvoiceStatus.CANCELLED;
    invoice.notes = reason ? `${invoice.notes || ''}\nCancelled${userId ? ` by ${userId}` : ''}: ${reason}`.trim() : invoice.notes;

    const saved = await this.invoiceRepository.save(invoice);

    // Post GL reversal: CR Accounts Receivable, DR Revenue (reverses the original posting)
    if (invoice.encounter?.facilityId && Number(invoice.totalAmount) > 0) {
      this.financeService.autoPostInvoiceJournal({
        facilityId: invoice.encounter.facilityId,
        invoiceNumber: `${invoice.invoiceNumber}-REVERSAL`,
        totalAmount: -Number(invoice.totalAmount),
        revenueCategory: invoice.paymentType || 'consultation',
        userId: userId || 'system',
      }, tenantId).catch(err => this.logger.error(`GL reversal failed for cancelled invoice ${invoice.invoiceNumber}: ${err.message}`, { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount, error: err.stack }));
    }

    return saved;
  }

  async refundInvoice(id: string, reason?: string, userId?: string, tenantId?: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const paymentRepo = manager.getRepository(Payment);

      const invoice = await invoiceRepo.findOne({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'payments', 'encounter'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
        throw new BadRequestException('Can only refund paid or partially paid invoices');
      }

      // Void all completed payments for this invoice
      const completedPayments = (invoice.payments || []).filter(p => p.status === PaymentStatus.COMPLETED);
      for (const payment of completedPayments) {
        payment.status = PaymentStatus.VOIDED;
        payment.notes = `${payment.notes || ''}\nRefunded: ${reason || 'Invoice refund'}`.trim();
        await paymentRepo.save(payment);
      }

      const refundAmount = Number(invoice.amountPaid);

      invoice.status = InvoiceStatus.REFUNDED;
      invoice.amountPaid = 0;
      invoice.balanceDue = Number(invoice.totalAmount);
      invoice.notes = reason ? `${invoice.notes || ''}\nRefunded: ${reason}`.trim() : invoice.notes;

      const saved = await invoiceRepo.save(invoice);

      // Post GL reversal: CR Revenue, DR Cash (reverses original invoice + payment postings)
      if (invoice.encounter?.facilityId && refundAmount > 0) {
        // Reverse the revenue recognition (CR AR, DR Revenue)
        this.financeService.autoPostInvoiceJournal({
          facilityId: invoice.encounter.facilityId,
          invoiceNumber: `${invoice.invoiceNumber}-REFUND`,
          totalAmount: -Number(invoice.totalAmount),
          revenueCategory: invoice.paymentType || 'consultation',
          userId: userId || 'system',
        }, tenantId).catch(err => this.logger.error(`GL reversal failed for refunded invoice ${invoice.invoiceNumber}: ${err.message}`, { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount, error: err.stack }));

        // Reverse the cash receipt (DR AR, CR Cash)
        this.financeService.autoPostPatientPaymentJournal({
          facilityId: invoice.encounter.facilityId,
          receiptNumber: `${invoice.invoiceNumber}-REFUND`,
          amount: -refundAmount,
          paymentMethod: completedPayments[0]?.method || 'cash',
          userId: userId || 'system',
        }, tenantId).catch(err => this.logger.error(`GL payment reversal failed for refunded invoice ${invoice.invoiceNumber}: ${err.message}`, { invoiceNumber: invoice.invoiceNumber, refundAmount, error: err.stack }));
      }

      return saved;
    });
  }

  /**
   * Add billable item to encounter's invoice (creates invoice if none exists)
   * Used by Orders, Lab, Pharmacy modules to auto-bill services
   */
  async addBillableItem(params: {
    encounterId: string;
    patientId: string;
    serviceCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    chargeType?: string;
    referenceType?: string;
    referenceId?: string;
    insurancePolicyId?: string;
    paymentType?: string;
    serviceId?: string;
    labTestId?: string;
  }, userId: string, tenantId?: string): Promise<InvoiceItem> {
    return this.dataSource.transaction(async (manager) => {
      // Find or create invoice for this encounter (with pessimistic lock)
      let invoice = await manager.findOne(Invoice, {
        where: {
          encounterId: params.encounterId,
          status: In([InvoiceStatus.DRAFT, InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        const invoiceNumber = await this.generateInvoiceNumber(tenantId);
        invoice = await manager.save(Invoice, manager.create(Invoice, {
          invoiceNumber,
          patientId: params.patientId,
          encounterId: params.encounterId,
          createdById: userId,
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          balanceDue: 0,
          status: InvoiceStatus.PENDING,
          ...(params.insurancePolicyId ? { insurancePolicyId: params.insurancePolicyId } : {}),
          ...(params.paymentType ? { paymentType: params.paymentType as any } : {}),
          ...(tenantId ? { tenantId } : {}),
        }));
      }

      // Deduplication: skip if item with same referenceType + referenceId already exists
      if (params.referenceType && params.referenceId) {
        const duplicate = await manager.findOne(InvoiceItem, {
          where: {
            invoiceId: invoice.id,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
          },
        });
        if (duplicate) {
          this.logger.warn(`Duplicate billable item skipped: ${params.referenceType}/${params.referenceId} on invoice ${invoice.invoiceNumber}`);
          return duplicate;
        }
      }

      // Resolve insurance pricing if applicable
      let resolvedUnitPrice = params.unitPrice;
      let insuranceCoveredAmount: number | undefined;
      let patientCopay: number | undefined;
      let coverageNote: string | undefined;

      // Check if the encounter is insurance-based
      const encounter = await manager.findOne(Encounter, {
        where: { id: params.encounterId },
        relations: ['insurancePolicy', 'insurancePolicy.provider'],
      });

      if (encounter?.payerType === 'insurance' && encounter.insurancePolicyId) {
        let isCovered = true;

        try {
          const resolved = await this.pricingEngineService.resolvePrice({
            serviceId: params.serviceId,
            labTestId: params.labTestId,
            patientId: params.patientId,
            encounterId: params.encounterId,
            payerType: 'insurance',
            insuranceProviderId: encounter.insurancePolicy?.providerId,
          }, tenantId);

          if (resolved && resolved.finalPrice > 0) {
            resolvedUnitPrice = resolved.finalPrice;
          }

          // Run coverage check (exclusions, annual limit, pre-auth)
          try {
            const coverageResult = await this.coverageCheckService.checkCoverage({
              patientId: params.patientId,
              items: [{ drugId: params.serviceCode, quantity: params.quantity }],
            }, tenantId);

            const detail = coverageResult.coverageDetails?.[0];
            if (detail && !detail.covered) {
              isCovered = false;
              coverageNote = detail.rejectionReason || 'Not covered by insurance';
              this.logger.log(`Item ${params.serviceCode} not covered: ${coverageNote}`);
            } else if (detail?.requiresPreAuth) {
              coverageNote = 'Requires pre-authorization';
            }
          } catch (covErr) {
            this.logger.warn(`Coverage check failed for ${params.serviceCode}: ${covErr.message}`);
          }

          // Calculate copay from policy (only if covered)
          const policy = encounter.insurancePolicy;
          if (policy && isCovered) {
            const copayPercent = Number(policy.copayPercentage || 0);
            const copayFixed = Number(policy.copayAmount || 0);
            const totalAmount = params.quantity * resolvedUnitPrice;

            if (copayPercent > 0 && copayPercent <= 100) {
              patientCopay = Math.round((totalAmount * copayPercent) / 100);
              insuranceCoveredAmount = totalAmount - patientCopay;
            } else if (copayFixed > 0) {
              patientCopay = Math.min(copayFixed, totalAmount);
              insuranceCoveredAmount = totalAmount - patientCopay;
            } else {
              insuranceCoveredAmount = totalAmount;
              patientCopay = 0;
            }
          } else if (!isCovered) {
            // Not covered — patient pays full amount
            insuranceCoveredAmount = 0;
            patientCopay = 0;
          }
        } catch (err) {
          this.logger.warn(`Failed to resolve insurance price for ${params.serviceCode}: ${err.message}`);
        }

        // Also ensure the invoice has insurance fields set
        if (!invoice.insurancePolicyId) {
          await manager.update(Invoice, invoice.id, {
            insurancePolicyId: encounter.insurancePolicyId,
            paymentType: 'insurance' as any,
          });
        }
      }

      // Add item
      const amount = params.quantity * resolvedUnitPrice;
      const item = await manager.save(InvoiceItem, manager.create(InvoiceItem, {
        invoiceId: invoice.id,
        serviceCode: params.serviceCode,
        description: params.description,
        chargeType: (params.chargeType as any) || undefined,
        quantity: params.quantity,
        unitPrice: resolvedUnitPrice,
        amount,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        insuranceCovered: insuranceCoveredAmount != null && insuranceCoveredAmount > 0,
        insuranceAmount: insuranceCoveredAmount || 0,
        copayAmount: patientCopay || 0,
        coverageNote: coverageNote,
      }));

      // Recalculate invoice totals
      await this.recalculateInvoice(invoice.id, tenantId);

      return item;
    });
  }

  /** Update an existing billable item by reference (returns true if updated) */
  async updateBillableItem(params: {
    referenceType: string;
    referenceId: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
  }, userId?: string, tenantId?: string): Promise<boolean> {
    const existing = await this.itemRepository.findOne({
      where: { referenceType: params.referenceType, referenceId: params.referenceId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!existing) return false;

    if (params.description !== undefined) existing.description = params.description;
    if (params.quantity !== undefined) existing.quantity = params.quantity;
    if (params.unitPrice !== undefined) existing.unitPrice = params.unitPrice;
    existing.amount = existing.quantity * existing.unitPrice;

    await this.itemRepository.save(existing);
    this.logger.log(`Billable item updated: ${params.referenceType}/${params.referenceId} by ${userId || 'unknown'}`);
    await this.recalculateInvoice(existing.invoiceId, tenantId);
    return true;
  }

  /** Remove a billable item by reference */
  async removeBillableItem(referenceType: string, referenceId: string, userId?: string, tenantId?: string): Promise<boolean> {
    const existing = await this.itemRepository.findOne({
      where: { referenceType, referenceId , ...(tenantId ? { tenantId } : {}) },
    });
    if (!existing) return false;
    const invoiceId = existing.invoiceId;
    await this.itemRepository.remove(existing);
    this.logger.log(`Billable item removed: ${referenceType}/${referenceId} from invoice ${invoiceId} by ${userId || 'unknown'}`);
    await this.recalculateInvoice(invoiceId, tenantId);
    return true;
  }

  // ============ REVENUE DASHBOARD ============

  async getRevenueDashboard(facilityId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly', tenantId?: string): Promise<{
    totalRevenue: number;
    revenueBySource: Array<{ source: string; current: number; previous: number; target: number }>;
    topGenerators: Array<{ name: string; department: string; revenue: number; visits: number }>;
    receivables: Array<{ id: string; customer: string; type: string; amount: number; dueDate: string; aging: number }>;
    dailyTrend: Array<{ day: string; revenue: number }>;
  }> {
    const now = new Date();
    let periodDays: number;
    
    switch (period) {
      case 'daily': periodDays = 1; break;
      case 'weekly': periodDays = 7; break;
      default: periodDays = 30;
    }
    
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - periodDays);
    startDate.setHours(0, 0, 0, 0);
    
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - periodDays);
    
    // Get current period payments
    const currentPaymentsQb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invoice', 'inv')
      .where('p.paid_at >= :startDate', { startDate })
      .andWhere('p.paid_at <= :now', { now })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED });

    if (tenantId) {
      currentPaymentsQb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const currentPayments = await currentPaymentsQb.getMany();
    
    // Get previous period payments for comparison
    const previousPaymentsQb = this.paymentRepository
      .createQueryBuilder('p')
      .where('p.paid_at >= :start', { start: previousStart })
      .andWhere('p.paid_at < :end', { end: startDate })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED });

    if (tenantId) {
      previousPaymentsQb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const previousPayments = await previousPaymentsQb.getMany();
    
    const totalRevenue = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const previousRevenue = previousPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    
    // Revenue by source - calculate from actual invoice items charge types
    const currentInvoiceIds = currentPayments.map(p => p.invoiceId).filter(Boolean);
    const previousInvoiceIds = previousPayments.map(p => p.invoiceId).filter(Boolean);
    
    // Get revenue breakdown by charge type from invoice items
    const getRevenueByChargeType = async (invoiceIds: string[]) => {
      if (invoiceIds.length === 0) {
        return { opd: 0, lab: 0, pharmacy: 0, imaging: 0, procedures: 0, other: 0 };
      }
      
      const items = await this.itemRepository
        .createQueryBuilder('item')
        .where('item.invoice_id IN (:...ids)', { ids: invoiceIds })
        .getMany();
      
      const breakdown = { opd: 0, lab: 0, pharmacy: 0, imaging: 0, procedures: 0, other: 0 };
      for (const item of items) {
        const amount = Number(item.amount) || (Number(item.quantity) * Number(item.unitPrice));
        const chargeType = (item.chargeType || 'other').toLowerCase();
        
        if (chargeType === 'consultation' || chargeType === 'opd') {
          breakdown.opd += amount;
        } else if (chargeType === 'laboratory' || chargeType === 'lab') {
          breakdown.lab += amount;
        } else if (chargeType === 'pharmacy' || chargeType === 'medication') {
          breakdown.pharmacy += amount;
        } else if (chargeType === 'radiology' || chargeType === 'imaging') {
          breakdown.imaging += amount;
        } else if (chargeType === 'procedure' || chargeType === 'procedures') {
          breakdown.procedures += amount;
        } else {
          breakdown.other += amount;
        }
      }
      return breakdown;
    };
    
    const currentBreakdown = await getRevenueByChargeType(currentInvoiceIds);
    const previousBreakdown = await getRevenueByChargeType(previousInvoiceIds);

    // Load revenue targets from settings (key: revenue_targets), fall back to defaults
    let revenueTargets: Record<string, number> = {
      opd: 5000000, lab: 2500000, pharmacy: 3000000,
      imaging: 500000, procedures: 1000000, other: 200000,
    };
    try {
      const targetSetting = await this.settingsService.getByKey('revenue_targets');
      const parsed = JSON.parse(targetSetting.value);
      if (parsed && typeof parsed === 'object') revenueTargets = { ...revenueTargets, ...parsed };
    } catch { /* use defaults */ }

    const sources = ['opd', 'lab', 'pharmacy', 'imaging', 'procedures', 'other'] as const;
    const revenueBySource = sources.map(source => ({
      source,
      current: currentBreakdown[source] || 0,
      previous: previousBreakdown[source] || 0,
      target: revenueTargets[source] || 0,
    }));
    
    // Get pending receivables
    const pendingInvoicesQb = this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.patient', 'patient')
      .where('inv.status IN (:...statuses)', { statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] })
      .orderBy('inv.dueDate', 'ASC')
      .take(10);

    if (tenantId) {
      pendingInvoicesQb.andWhere('inv.tenant_id = :tenantId', { tenantId });
    }

    const pendingInvoices = await pendingInvoicesQb.getMany();
    
    const receivables = pendingInvoices.map(inv => {
      const dueDate = inv.dueDate || new Date(inv.createdAt);
      dueDate.setDate(dueDate.getDate() + 30); // Default 30-day terms
      const aging = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: inv.id,
        customer: inv.patient?.fullName || 'Unknown Patient',
        type: 'patient' as const,
        amount: Number(inv.totalAmount) - Number(inv.amountPaid || 0),
        dueDate: dueDate.toISOString().split('T')[0],
        aging,
      };
    });
    
    // Daily trend for the past 7 days
    const dailyTrend: Array<{ day: string; revenue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayPayments = currentPayments.filter(p => {
        const paidAt = new Date(p.paidAt);
        return paidAt >= dayStart && paidAt <= dayEnd;
      });
      
      dailyTrend.push({
        day: day.toLocaleDateString('en-UG', { weekday: 'short' }),
        revenue: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      });
    }
    
    // Top generators — real query from invoice items grouped by charge type and description
    const topGeneratorsQb = this.itemRepository
      .createQueryBuilder('item')
      .select('item.description', 'name')
      .addSelect('item.charge_type', 'chargeType')
      .addSelect('SUM(item.amount)', 'revenue')
      .addSelect('COUNT(DISTINCT item.invoice_id)', 'visits')
      .innerJoin('item.invoice', 'inv')
      .where('inv.created_at >= :startDate', { startDate })
      .andWhere('inv.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('item.description')
      .addGroupBy('item.charge_type')
      .orderBy('revenue', 'DESC')
      .limit(10);

    if (tenantId) {
      topGeneratorsQb.andWhere('inv.tenant_id = :tenantId', { tenantId });
    }

    const topGeneratorsRaw = await topGeneratorsQb.getRawMany();

    const deptMap: Record<string, string> = {
      consultation: 'OPD',
      lab: 'Laboratory',
      pharmacy: 'Pharmacy',
      radiology: 'Radiology',
      procedure: 'Theatre',
      bed: 'IPD',
      nursing: 'Nursing',
      other: 'Other',
    };

    const topGenerators = topGeneratorsRaw.map(r => ({
      name: r.name || r.description,
      department: deptMap[r.chargeType || r.charge_type] || 'Other',
      revenue: Number(r.revenue) || 0,
      visits: Number(r.visits) || 0,
    })).filter(g => g.revenue > 0);
    
    return {
      totalRevenue,
      revenueBySource,
      topGenerators,
      receivables,
      dailyTrend,
    };
  }

  // ============ WRITE-OFFS ============

  async writeOffInvoice(invoiceId: string, reason: string, userId: string, tenantId?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, ...(tenantId ? { tenantId } : {}) },
      relations: ['encounter'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Cannot write off a paid invoice');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Cannot write off a cancelled invoice');

    const writeOffAmount = Number(invoice.balanceDue);
    invoice.status = InvoiceStatus.CANCELLED;
    invoice.notes = `${invoice.notes || ''}\nWRITTEN OFF (${new Date().toISOString().slice(0, 10)}): ${reason} — Amount: ${writeOffAmount}`.trim();
    const saved = await this.invoiceRepository.save(invoice);

    // GL: DR Bad Debt Expense (5503), CR Accounts Receivable (1200)
    if (invoice.encounter?.facilityId) {
      this.financeService.autoPostInvoiceJournal({
        facilityId: invoice.encounter.facilityId,
        invoiceNumber: `WRITEOFF-${invoice.invoiceNumber}`,
        totalAmount: writeOffAmount,
        revenueCategory: 'write_off',
        userId,
      }, tenantId).catch(err => this.logger.error(`GL write-off posting failed for ${invoice.invoiceNumber}: ${err.message}`, err.stack));
    }

    return saved;
  }

  // ============ RECEIPT PRINT DATA ============

  async getReceiptPrintData(paymentId: string, tenantId?: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
      relations: ['invoice', 'invoice.items', 'invoice.patient', 'receivedBy'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const invoice = payment.invoice;
    return {
      receiptNumber: payment.receiptNumber,
      date: payment.paidAt || payment.createdAt,
      patientName: invoice?.patient?.fullName || 'Walk-in',
      patientMrn: invoice?.patient?.mrn || '',
      invoiceNumber: invoice?.invoiceNumber || '',
      items: (invoice?.items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
      })),
      subtotal: Number(invoice?.subtotal || 0),
      tax: Number(invoice?.taxAmount || 0),
      discount: Number(invoice?.discountAmount || 0),
      totalAmount: Number(invoice?.totalAmount || 0),
      amountPaid: Number(payment.amount),
      paymentMethod: payment.method,
      transactionReference: payment.transactionReference,
      balanceDue: Number(invoice?.balanceDue || 0),
      cashier: payment.receivedBy?.fullName || payment.receivedBy?.email || '',
    };
  }
}
