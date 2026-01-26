import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PharmacySale, PharmacySaleItem, SaleStatus, SaleType } from '../../database/entities/pharmacy-sale.entity';
import { Item, StockLedger, MovementType } from '../../database/entities/inventory.entity';
import { CreatePharmacySaleDto, CompleteSaleDto } from './pharmacy.dto';

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(PharmacySale) private saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem) private saleItemRepo: Repository<PharmacySaleItem>,
    @InjectRepository(Item) private inventoryRepo: Repository<Item>,
    @InjectRepository(StockLedger) private movementRepo: Repository<StockLedger>,
  ) {}

  async createSale(dto: CreatePharmacySaleDto, userId: string) {
    const saleNumber = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    let subtotal = 0;
    for (const item of dto.items) {
      const discount = item.discountPercent || 0;
      const amount = item.quantity * item.unitPrice * (1 - discount / 100);
      subtotal += amount;
    }
    
    const discountAmount = dto.discountAmount || 0;
    const totalAmount = subtotal - discountAmount;

    const sale = this.saleRepo.create({
      saleNumber,
      storeId: dto.storeId,
      saleType: dto.saleType || SaleType.OTC,
      patientId: dto.patientId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      prescriptionId: dto.prescriptionId,
      paymentMethod: dto.paymentMethod || 'cash',
      transactionReference: dto.transactionReference,
      subtotal,
      discountAmount,
      totalAmount,
      notes: dto.notes,
      status: SaleStatus.PENDING,
      soldById: userId,
    });
    const saved = await this.saleRepo.save(sale);

    for (const item of dto.items) {
      const discount = item.discountPercent || 0;
      const amount = item.quantity * item.unitPrice * (1 - discount / 100);
      const saleItem = this.saleItemRepo.create({
        saleId: saved.id,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        batchNumber: item.batchNumber || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: discount,
        amount,
        instructions: item.instructions,
      });
      if (item.expiryDate) {
        saleItem.expiryDate = new Date(item.expiryDate);
      }
      await this.saleItemRepo.save(saleItem);
    }

    return this.findSale(saved.id);
  }

  async findAllSales(storeId?: string, status?: SaleStatus, date?: string, limit = 50) {
    const query = this.saleRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.store', 'st')
      .leftJoinAndSelect('s.patient', 'p');
    if (storeId) query.andWhere('s.storeId = :storeId', { storeId });
    if (status) query.andWhere('s.status = :status', { status });
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query.andWhere('s.createdAt BETWEEN :start AND :end', { start, end });
    }
    const takeLimit = limit ? Number(limit) : 50;
    return query.orderBy('s.createdAt', 'DESC').take(takeLimit).getMany();
  }

  async findSale(id: string) {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: ['store', 'patient', 'soldBy'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    const items = await this.saleItemRepo.find({ where: { saleId: id } });
    return { ...sale, items };
  }

  async completeSale(id: string, dto: CompleteSaleDto, userId: string) {
    const sale = await this.findSale(id);
    if (sale.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Sale is not pending');
    }

    if (dto.amountPaid < Number(sale.totalAmount)) {
      throw new BadRequestException('Insufficient payment amount');
    }

    // Deduct stock for each item - record in stock ledger
    for (const item of sale.items) {
      // Create stock ledger entry (stock movement)
      await this.movementRepo.save(this.movementRepo.create({
        itemId: item.itemId,
        movementType: MovementType.SALE,
        quantity: -item.quantity,
        balanceAfter: 0, // Would need to calculate from previous balance
        batchNumber: item.batchNumber,
        referenceType: 'pharmacy_sale',
        referenceId: sale.id,
        notes: `POS Sale: ${sale.saleNumber}`,
        createdById: userId,
        facilityId: sale.store?.facilityId,
      }));
    }

    sale.amountPaid = dto.amountPaid;
    sale.paymentMethod = dto.paymentMethod || sale.paymentMethod;
    if (dto.transactionReference) {
      sale.transactionReference = dto.transactionReference;
    }
    sale.status = SaleStatus.COMPLETED;
    await this.saleRepo.save(sale);

    return this.findSale(id);
  }

  async cancelSale(id: string) {
    const sale = await this.findSale(id);
    if (sale.status === SaleStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed sale');
    }
    sale.status = SaleStatus.CANCELLED;
    return this.saleRepo.save(sale);
  }

  async getDailySummary(storeId: string, date: string) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    const result = await this.saleRepo.createQueryBuilder('s')
      .select([
        'COUNT(*) as totalSales',
        'SUM(s.totalAmount) as totalRevenue',
        'SUM(s.discountAmount) as totalDiscounts',
        "SUM(CASE WHEN s.paymentMethod = 'cash' THEN s.amountPaid ELSE 0 END) as cashTotal",
        "SUM(CASE WHEN s.paymentMethod = 'mobile_money' THEN s.amountPaid ELSE 0 END) as mobileTotal",
      ])
      .where('s.storeId = :storeId', { storeId })
      .andWhere('s.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('s.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();

    return result;
  }
}
