import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Invoice, InvoiceItem, Payment, InvoiceStatus, PaymentStatus } from '../../database/entities/invoice.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateInvoiceDto, AddInvoiceItemDto, CreatePaymentDto, InvoiceQueryDto } from './billing.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const last = await this.invoiceRepository
      .createQueryBuilder('inv')
      .where('inv.invoice_number LIKE :prefix', { prefix: `INV${datePrefix}%` })
      .orderBy('inv.invoice_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (last) {
      const lastSeq = parseInt(last.invoiceNumber.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `INV${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  private async generateReceiptNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const last = await this.paymentRepository
      .createQueryBuilder('pay')
      .where('pay.receipt_number LIKE :prefix', { prefix: `RCP${datePrefix}%` })
      .orderBy('pay.receipt_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (last) {
      const lastSeq = parseInt(last.receiptNumber.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `RCP${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  async createInvoice(dto: CreateInvoiceDto, userId: string): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();

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

    const taxAmount = dto.taxPercent ? (subtotal * dto.taxPercent / 100) : 0;
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
      items,
    });

    const saved = await this.invoiceRepository.save(invoice);

    // Update encounter status if linked
    if (dto.encounterId) {
      const encounter = await this.encounterRepository.findOne({
        where: { id: dto.encounterId },
      });
      if (encounter && encounter.status === EncounterStatus.PENDING_PHARMACY) {
        encounter.status = EncounterStatus.PENDING_PAYMENT;
        await this.encounterRepository.save(encounter);
      }
    }

    return this.findInvoice(saved.id);
  }

  async findAll(query: InvoiceQueryDto): Promise<{ data: Invoice[]; total: number }> {
    const { status, patientId, encounterId, dateFrom, dateTo, search, patientMrn, page = 1, limit = 20 } = query;

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('invoice.payments', 'payments');

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

  async findInvoice(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber },
      relations: ['items', 'payments', 'patient'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async addItem(invoiceId: string, dto: AddInvoiceItemDto): Promise<Invoice> {
    const invoice = await this.findInvoice(invoiceId);

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

    // Recalculate invoice totals
    return this.recalculateInvoice(invoiceId);
  }

  private async recalculateInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.findInvoice(invoiceId);

    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalAmount = subtotal + Number(invoice.taxAmount) - Number(invoice.discountAmount);
    const balanceDue = totalAmount - Number(invoice.amountPaid);

    invoice.subtotal = subtotal;
    invoice.totalAmount = totalAmount;
    invoice.balanceDue = balanceDue;

    // Update status based on payments
    if (balanceDue <= 0) {
      invoice.status = InvoiceStatus.PAID;
    } else if (Number(invoice.amountPaid) > 0) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }

    return this.invoiceRepository.save(invoice);
  }

  async recordPayment(dto: CreatePaymentDto, userId: string): Promise<Payment> {
    // Use transaction to prevent race conditions when multiple payments hit simultaneously
    return this.dataSource.transaction(async (manager) => {
      // Lock the invoice row for update to prevent concurrent payment issues
      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
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

      const receiptNumber = await this.generateReceiptNumber();

      const payment = manager.create(Payment, {
        receiptNumber,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        transactionReference: dto.transactionReference,
        notes: dto.notes,
        receivedById: userId,
      });

      const savedPayment = await manager.save(payment);

      // Update invoice totals
      invoice.amountPaid = Number(invoice.amountPaid) + dto.amount;
      invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

      let invoiceFullyPaid = false;
      if (invoice.balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
        invoiceFullyPaid = true;

        // Complete encounter if linked
        if (invoice.encounterId) {
          await manager.update(Encounter, { id: invoice.encounterId }, {
            status: EncounterStatus.COMPLETED,
            endTime: new Date(),
          });
        }
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      await manager.update(Invoice, { id: invoice.id }, {
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        status: invoice.status,
      });

      // Send thank you SMS/Email after full payment (non-blocking)
      if (invoiceFullyPaid && invoice.patientId) {
        const fullInvoice = await manager.findOne(Invoice, {
          where: { id: invoice.id },
          relations: ['patient', 'encounter'],
        });
        
        if (fullInvoice?.patient) {
          const patientName = fullInvoice.patient.fullName;
          // Get facilityId from encounter or use default
          const facilityId = fullInvoice.encounter?.facilityId || 'c02ac4ff-f644-4040-afd3-d538311f996e';
          
          // Send thank you in background (don't block payment completion)
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

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId },
      order: { paidAt: 'DESC' },
      relations: ['receivedBy'],
    });
  }

  async listPayments(params: { startDate?: string; endDate?: string; method?: string }): Promise<Payment[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('payment.receivedBy', 'receivedBy');

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

  async voidPayment(paymentId: string, reason: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['invoice'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.VOIDED) {
      throw new BadRequestException('Payment is already voided');
    }

    // Void the payment
    payment.status = PaymentStatus.VOIDED;
    payment.notes = `${payment.notes || ''}\nVoided: ${reason}`.trim();

    await this.paymentRepository.save(payment);

    // Recalculate invoice totals
    if (payment.invoice) {
      const invoice = payment.invoice;
      invoice.amountPaid = Number(invoice.amountPaid) - Number(payment.amount);
      invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);
      
      if (invoice.amountPaid <= 0) {
        invoice.status = InvoiceStatus.PENDING;
      } else if (invoice.balanceDue > 0) {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      await this.invoiceRepository.save(invoice);
    }

    return payment;
  }

  async getDailyRevenue(date: Date = new Date()): Promise<{
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

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.paid_at BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();

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

  async getPendingInvoices(): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: [
        { status: InvoiceStatus.PENDING },
        { status: InvoiceStatus.PARTIALLY_PAID },
      ],
      relations: ['patient', 'items'],
      order: { createdAt: 'ASC' },
    });
  }

  async cancelInvoice(id: string, reason?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['patient'],
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
    invoice.notes = reason ? `${invoice.notes || ''}\nCancelled: ${reason}`.trim() : invoice.notes;
    
    return this.invoiceRepository.save(invoice);
  }

  async refundInvoice(id: string, reason?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['patient'],
    });
    
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    
    if (invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
      throw new BadRequestException('Can only refund paid or partially paid invoices');
    }
    
    invoice.status = InvoiceStatus.REFUNDED;
    invoice.notes = reason ? `${invoice.notes || ''}\nRefunded: ${reason}`.trim() : invoice.notes;
    
    return this.invoiceRepository.save(invoice);
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
  }, userId: string): Promise<InvoiceItem> {
    // Find or create invoice for this encounter
    let invoice = await this.invoiceRepository.findOne({
      where: { 
        encounterId: params.encounterId,
        status: In([InvoiceStatus.DRAFT, InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
      },
    });

    if (!invoice) {
      // Create new invoice for this encounter
      const invoiceNumber = await this.generateInvoiceNumber();
      invoice = await this.invoiceRepository.save(this.invoiceRepository.create({
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
      }));
    }

    // Add item
    const amount = params.quantity * params.unitPrice;
    const item = await this.itemRepository.save(this.itemRepository.create({
      invoiceId: invoice.id,
      serviceCode: params.serviceCode,
      description: params.description,
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      amount,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
    }));

    // Recalculate invoice totals
    await this.recalculateInvoice(invoice.id);

    return item;
  }

  // ============ REVENUE DASHBOARD ============

  async getRevenueDashboard(facilityId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<{
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
    const currentPayments = await this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invoice', 'inv')
      .where('p.paid_at >= :startDate', { startDate })
      .andWhere('p.paid_at <= :now', { now })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();
    
    // Get previous period payments for comparison
    const previousPayments = await this.paymentRepository
      .createQueryBuilder('p')
      .where('p.paid_at >= :start', { start: previousStart })
      .andWhere('p.paid_at < :end', { end: startDate })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();
    
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
    
    const sources = ['opd', 'lab', 'pharmacy', 'imaging', 'procedures', 'other'] as const;
    const revenueBySource = sources.map(source => ({
      source,
      current: currentBreakdown[source] || 0,
      previous: previousBreakdown[source] || 0,
      target: source === 'opd' ? 5000000 : 
              source === 'lab' ? 2500000 : 
              source === 'pharmacy' ? 3000000 :
              source === 'imaging' ? 500000 :
              source === 'procedures' ? 1000000 : 200000,
    }));
    
    // Get pending receivables
    const pendingInvoices = await this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.patient', 'patient')
      .where('inv.status IN (:...statuses)', { statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID] })
      .orderBy('inv.dueDate', 'ASC')
      .take(10)
      .getMany();
    
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
    
    // Top generators (services with most revenue - simplified)
    const topGenerators = [
      { name: 'Consultation Services', department: 'OPD', revenue: totalRevenue * 0.3, visits: Math.round(totalRevenue / 50000) },
      { name: 'Laboratory Tests', department: 'Laboratory', revenue: totalRevenue * 0.2, visits: Math.round(totalRevenue / 25000) },
      { name: 'Pharmacy Sales', department: 'Pharmacy', revenue: totalRevenue * 0.25, visits: Math.round(totalRevenue / 15000) },
      { name: 'Imaging Services', department: 'Radiology', revenue: totalRevenue * 0.15, visits: Math.round(totalRevenue / 100000) },
      { name: 'Procedures', department: 'Theatre', revenue: totalRevenue * 0.1, visits: Math.round(totalRevenue / 200000) },
    ].filter(g => g.revenue > 0);
    
    return {
      totalRevenue,
      revenueBySource,
      topGenerators,
      receivables,
      dailyTrend,
    };
  }
}
