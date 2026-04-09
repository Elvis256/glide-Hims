import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PosRegister,
  PosShift,
  PosPaymentSplit,
  WholesaleCustomer,
  PricingTier,
  Delivery,
} from '../../database/entities/pos.entity';
import {
  CreateRegisterDto,
  UpdateRegisterDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateWholesaleCustomerDto,
  UpdateWholesaleCustomerDto,
  CreatePricingTierDto,
  CreateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './pos.dto';
import { add, subtract, multiply, divide } from '../../common/utils/currency';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    @InjectRepository(PosRegister) private registerRepo: Repository<PosRegister>,
    @InjectRepository(PosShift) private shiftRepo: Repository<PosShift>,
    @InjectRepository(PosPaymentSplit) private paymentSplitRepo: Repository<PosPaymentSplit>,
    @InjectRepository(WholesaleCustomer) private customerRepo: Repository<WholesaleCustomer>,
    @InjectRepository(PricingTier) private tierRepo: Repository<PricingTier>,
    @InjectRepository(Delivery) private deliveryRepo: Repository<Delivery>,
    private dataSource: DataSource,
  ) {}

  // ─── Registers ─────────────────────────────────────────────────────────────

  async createRegister(dto: CreateRegisterDto, tenantId: string) {
    const register = this.registerRepo.create({ ...dto, tenantId });
    return this.registerRepo.save(register);
  }

  async findAllRegisters(tenantId: string) {
    return this.registerRepo.find({
      where: { tenantId },
      relations: ['store'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateRegister(id: string, dto: UpdateRegisterDto, tenantId: string) {
    const register = await this.registerRepo.findOne({ where: { id, tenantId } });
    if (!register) throw new NotFoundException('Register not found');
    Object.assign(register, dto);
    return this.registerRepo.save(register);
  }

  // ─── Shifts ────────────────────────────────────────────────────────────────

  async openShift(dto: OpenShiftDto, cashierId: string, tenantId: string) {
    // Verify no open shift for this cashier
    const existing = await this.shiftRepo.findOne({
      where: { cashierId, tenantId, status: 'open' },
    });
    if (existing) {
      throw new BadRequestException('You already have an open shift. Close it before opening a new one.');
    }

    // Verify register exists and belongs to tenant
    const register = await this.registerRepo.findOne({
      where: { id: dto.registerId, tenantId, status: 'active' },
    });
    if (!register) throw new NotFoundException('Register not found or inactive');

    // Verify no other open shift on this register
    const registerShift = await this.shiftRepo.findOne({
      where: { registerId: dto.registerId, tenantId, status: 'open' },
    });
    if (registerShift) {
      throw new BadRequestException('This register already has an open shift.');
    }

    const shift = this.shiftRepo.create({
      registerId: dto.registerId,
      cashierId,
      openedAt: new Date(),
      openingBalance: dto.openingBalance,
      status: 'open',
      tenantId,
    });
    return this.shiftRepo.save(shift);
  }

  async closeShift(dto: CloseShiftDto, cashierId: string, tenantId: string) {
    return this.dataSource.transaction(async (manager) => {
      const shift = await manager.findOne(PosShift, {
        where: { cashierId, tenantId, status: 'open' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('No open shift found');

      // Count ALL payment types for expected balance
      const totalSales = add(
        add(Number(shift.cashSales), Number(shift.mobileMoneySales)),
        Number(shift.cardSales),
      );
      const expectedBalance = add(Number(shift.openingBalance), Number(shift.cashSales));
      const cashDifference = subtract(dto.closingBalance, expectedBalance);

      shift.closedAt = new Date();
      shift.closingBalance = dto.closingBalance;
      shift.expectedBalance = expectedBalance;
      shift.cashDifference = cashDifference;
      shift.notes = dto.notes || (null as any);
      shift.status = 'closed';

      return manager.save(PosShift, shift);
    });
  }

  async getCurrentShift(cashierId: string, tenantId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { cashierId, tenantId, status: 'open' },
      relations: ['register', 'cashier'],
    });
    if (!shift) return null;
    return shift;
  }

  async getShiftReport(shiftId: string, tenantId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, tenantId },
      relations: ['register', 'cashier'],
    });
    if (!shift) throw new NotFoundException('Shift not found');

    // Get payment splits for this shift period
    const splits = await this.dataSource
      .createQueryBuilder()
      .select('ps.payment_method', 'paymentMethod')
      .addSelect('SUM(ps.amount)', 'total')
      .addSelect('COUNT(DISTINCT ps.sale_id)', 'saleCount')
      .from('pos_payment_splits', 'ps')
      .where('ps.tenant_id = :tenantId', { tenantId })
      .andWhere('ps.created_at >= :openedAt', { openedAt: shift.openedAt })
      .andWhere(shift.closedAt ? 'ps.created_at <= :closedAt' : '1=1', { closedAt: shift.closedAt })
      .groupBy('ps.payment_method')
      .getRawMany();

    return {
      shift,
      paymentBreakdown: splits,
      summary: {
        totalSales: Number(shift.cashSales) + Number(shift.mobileMoneySales) + Number(shift.cardSales),
        transactionCount: shift.transactionCount,
        cashDifference: shift.cashDifference,
      },
    };
  }

  async getShiftHistory(tenantId: string, registerId?: string) {
    const qb = this.shiftRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.register', 'register')
      .leftJoinAndSelect('s.cashier', 'cashier')
      .where('s.tenant_id = :tenantId', { tenantId })
      .orderBy('s.opened_at', 'DESC');

    if (registerId) {
      qb.andWhere('s.register_id = :registerId', { registerId });
    }

    return qb.getMany();
  }

  async recordSaleInShift(cashierId: string, tenantId: string, paymentMethod: string, amount: number) {
    await this.dataSource.transaction(async (manager) => {
      const shift = await manager.findOne(PosShift, {
        where: { cashierId, tenantId, status: 'open' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        this.logger.warn(`No open shift for cashier ${cashierId} — sale not tracked in shift`);
        return;
      }

      shift.transactionCount += 1;
      switch (paymentMethod) {
        case 'cash':
          shift.cashSales = add(Number(shift.cashSales), amount);
          break;
        case 'mobile_money':
          shift.mobileMoneySales = add(Number(shift.mobileMoneySales), amount);
          break;
        case 'card':
          shift.cardSales = add(Number(shift.cardSales), amount);
          break;
        default:
          shift.cashSales = add(Number(shift.cashSales), amount);
      }

      await manager.save(PosShift, shift);
    });
  }

  // ─── Wholesale Customers ──────────────────────────────────────────────────

  async createCustomer(dto: CreateWholesaleCustomerDto, tenantId: string) {
    const customer = this.customerRepo.create({ ...dto, tenantId });
    return this.customerRepo.save(customer);
  }

  async findAllCustomers(tenantId: string) {
    return this.customerRepo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  async findCustomer(id: string, tenantId: string) {
    const customer = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Wholesale customer not found');
    return customer;
  }

  async updateCustomer(id: string, dto: UpdateWholesaleCustomerDto, tenantId: string) {
    const customer = await this.customerRepo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Wholesale customer not found');
    Object.assign(customer, dto);
    return this.customerRepo.save(customer);
  }

  async getCustomerBalance(id: string, tenantId: string) {
    const customer = await this.findCustomer(id, tenantId);
    return {
      customerId: customer.id,
      name: customer.name,
      creditLimit: customer.creditLimit,
      outstandingBalance: customer.outstandingBalance,
      availableCredit: Number(customer.creditLimit) - Number(customer.outstandingBalance),
    };
  }

  // ─── Pricing Tiers ────────────────────────────────────────────────────────

  async createTier(dto: CreatePricingTierDto, tenantId: string) {
    const tier = this.tierRepo.create({ ...dto, tenantId });
    return this.tierRepo.save(tier);
  }

  async findAllTiers(tenantId: string) {
    return this.tierRepo.find({
      where: { tenantId, status: 'active' },
      order: { discountPercent: 'ASC' },
    });
  }

  applyTierDiscount(unitPrice: number, discountPercent: number): number {
    return multiply(unitPrice, subtract(1, divide(discountPercent, 100)));
  }

  // ─── Deliveries ───────────────────────────────────────────────────────────

  async createDelivery(dto: CreateDeliveryDto, tenantId: string) {
    const delivery = this.deliveryRepo.create({
      ...dto,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      tenantId,
    });
    return this.deliveryRepo.save(delivery);
  }

  async updateDeliveryStatus(id: string, dto: UpdateDeliveryStatusDto, tenantId: string) {
    const delivery = await this.deliveryRepo.findOne({ where: { id, tenantId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    delivery.status = dto.status;
    if (dto.notes) delivery.notes = dto.notes;

    if (dto.status === 'dispatched') delivery.dispatchedAt = new Date();
    if (dto.status === 'delivered') delivery.deliveredAt = new Date();

    return this.deliveryRepo.save(delivery);
  }

  async findAllDeliveries(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;

    return this.deliveryRepo.find({
      where,
      relations: ['sale', 'customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDeliveryReport(tenantId: string) {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .from('deliveries', 'd')
      .where('d.tenant_id = :tenantId', { tenantId })
      .andWhere('d.deleted_at IS NULL')
      .groupBy('d.status')
      .getRawMany();

    return result;
  }
}
