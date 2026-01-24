import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceItem, Payment, InvoiceStatus, PaymentStatus } from '../../database/entities/invoice.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateInvoiceDto, AddInvoiceItemDto, CreatePaymentDto, InvoiceQueryDto } from './billing.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private itemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
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
    const { status, patientId, encounterId, dateFrom, dateTo, page = 1, limit = 20 } = query;

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
    const invoice = await this.invoiceRepository.findOne({
      where: { id: dto.invoiceId },
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

    const payment = this.paymentRepository.create({
      receiptNumber,
      invoiceId: dto.invoiceId,
      amount: dto.amount,
      method: dto.method,
      transactionReference: dto.transactionReference,
      notes: dto.notes,
      receivedById: userId,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update invoice totals directly without loading relations
    invoice.amountPaid = Number(invoice.amountPaid) + dto.amount;
    invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

    if (invoice.balanceDue <= 0) {
      invoice.status = InvoiceStatus.PAID;

      // Complete encounter if linked
      if (invoice.encounterId) {
        await this.encounterRepository.update(
          { id: invoice.encounterId },
          { status: EncounterStatus.COMPLETED, endTime: new Date() }
        );
      }
    } else {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }

    await this.invoiceRepository.update({ id: invoice.id }, {
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      status: invoice.status,
    });

    return savedPayment;
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId },
      order: { paidAt: 'DESC' },
      relations: ['receivedBy'],
    });
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
}
