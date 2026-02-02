import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { PriceAgreement, PriceAgreementStatus } from '../../database/entities/price-agreement.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { CreatePriceAgreementDto, UpdatePriceAgreementDto, ComparePricesDto } from './dto/price-agreement.dto';

@Injectable()
export class PriceAgreementsService {
  private readonly logger = new Logger(PriceAgreementsService.name);

  constructor(
    @InjectRepository(PriceAgreement) private agreementRepo: Repository<PriceAgreement>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
  ) {}

  async create(dto: CreatePriceAgreementDto, userId: string): Promise<PriceAgreement> {
    const agreement = this.agreementRepo.create({
      supplierId: dto.supplierId,
      facilityId: dto.facilityId,
      itemId: dto.itemId,
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      category: dto.category,
      unitPrice: dto.unitPrice,
      unit: dto.unit || 'unit',
      validFrom: new Date(dto.validFrom),
      validTo: new Date(dto.validTo),
      volumeDiscounts: dto.volumeDiscounts,
      notes: dto.notes,
      status: PriceAgreementStatus.PENDING,
      createdById: userId,
      priceHistory: [{ price: dto.unitPrice, date: new Date().toISOString(), changePercent: 0 }],
    });

    const saved = await this.agreementRepo.save(agreement);
    return this.findOne(saved.id);
  }

  async findAll(facilityId: string, options: { status?: PriceAgreementStatus; supplierId?: string; itemCode?: string } = {}) {
    const qb = this.agreementRepo
      .createQueryBuilder('agreement')
      .leftJoinAndSelect('agreement.supplier', 'supplier')
      .where('agreement.facilityId = :facilityId', { facilityId });

    if (options.status) {
      qb.andWhere('agreement.status = :status', { status: options.status });
    }
    if (options.supplierId) {
      qb.andWhere('agreement.supplierId = :supplierId', { supplierId: options.supplierId });
    }
    if (options.itemCode) {
      qb.andWhere('agreement.itemCode = :itemCode', { itemCode: options.itemCode });
    }

    return qb.orderBy('agreement.validTo', 'ASC').getMany();
  }

  async findOne(id: string): Promise<PriceAgreement> {
    const agreement = await this.agreementRepo.findOne({
      where: { id },
      relations: ['supplier', 'createdBy', 'approvedBy'],
    });
    if (!agreement) throw new NotFoundException('Price agreement not found');
    return agreement;
  }

  async update(id: string, dto: UpdatePriceAgreementDto): Promise<PriceAgreement> {
    const agreement = await this.findOne(id);

    if (dto.unitPrice !== undefined && dto.unitPrice !== Number(agreement.unitPrice)) {
      const history = agreement.priceHistory || [];
      const prevPrice = Number(agreement.unitPrice);
      const changePercent = prevPrice > 0 ? ((dto.unitPrice - prevPrice) / prevPrice) * 100 : 0;
      history.push({
        price: dto.unitPrice,
        date: new Date().toISOString(),
        changePercent,
      });
      agreement.priceHistory = history;
      agreement.unitPrice = dto.unitPrice;
    }

    if (dto.validFrom) agreement.validFrom = new Date(dto.validFrom);
    if (dto.validTo) agreement.validTo = new Date(dto.validTo);
    if (dto.volumeDiscounts) agreement.volumeDiscounts = dto.volumeDiscounts as { minQuantity: number; maxQuantity: number | null; discountPercent: number }[];
    if (dto.notes !== undefined) agreement.notes = dto.notes;
    if (dto.status) agreement.status = dto.status;

    await this.agreementRepo.save(agreement);
    return this.findOne(id);
  }

  async activate(id: string, userId: string): Promise<PriceAgreement> {
    const agreement = await this.findOne(id);
    if (agreement.status !== PriceAgreementStatus.PENDING && agreement.status !== PriceAgreementStatus.DRAFT) {
      throw new BadRequestException('Only pending/draft agreements can be activated');
    }
    agreement.status = PriceAgreementStatus.ACTIVE;
    agreement.approvedById = userId;
    await this.agreementRepo.save(agreement);
    return this.findOne(id);
  }

  async terminate(id: string, reason: string): Promise<PriceAgreement> {
    const agreement = await this.findOne(id);
    agreement.status = PriceAgreementStatus.TERMINATED;
    agreement.notes = (agreement.notes || '') + `\nTerminated: ${reason}`;
    await this.agreementRepo.save(agreement);
    return this.findOne(id);
  }

  async comparePrices(facilityId: string, dto: ComparePricesDto) {
    const now = new Date();
    const agreements = await this.agreementRepo.find({
      where: {
        facilityId,
        itemCode: dto.itemCode,
        status: PriceAgreementStatus.ACTIVE,
        validFrom: LessThan(now),
        validTo: MoreThan(now),
      },
      relations: ['supplier'],
      order: { unitPrice: 'ASC' },
    });

    return agreements.map((a) => {
      let effectivePrice = Number(a.unitPrice);
      let appliedDiscount = 0;

      if (dto.quantity && a.volumeDiscounts) {
        for (const discount of a.volumeDiscounts) {
          if (dto.quantity >= discount.minQuantity && (discount.maxQuantity === null || dto.quantity <= discount.maxQuantity)) {
            appliedDiscount = discount.discountPercent;
            effectivePrice = Number(a.unitPrice) * (1 - discount.discountPercent / 100);
            break;
          }
        }
      }

      return {
        id: a.id,
        supplier: a.supplier,
        itemCode: a.itemCode,
        itemName: a.itemName,
        unitPrice: a.unitPrice,
        effectivePrice,
        appliedDiscount,
        unit: a.unit,
        validTo: a.validTo,
      };
    });
  }

  async getBestPrice(facilityId: string, itemCode: string, quantity?: number) {
    const prices = await this.comparePrices(facilityId, { itemCode, quantity });
    return prices.length > 0 ? prices[0] : null;
  }

  async checkExpiringAgreements(facilityId: string, daysAhead: number = 30): Promise<PriceAgreement[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.agreementRepo.find({
      where: {
        facilityId,
        status: PriceAgreementStatus.ACTIVE,
        validTo: LessThan(futureDate),
      },
      relations: ['supplier'],
    });
  }

  async getStats(facilityId: string) {
    const [active, pending, expired, total] = await Promise.all([
      this.agreementRepo.count({ where: { facilityId, status: PriceAgreementStatus.ACTIVE } }),
      this.agreementRepo.count({ where: { facilityId, status: PriceAgreementStatus.PENDING } }),
      this.agreementRepo.count({ where: { facilityId, status: PriceAgreementStatus.EXPIRED } }),
      this.agreementRepo.count({ where: { facilityId } }),
    ]);

    const uniqueItems = await this.agreementRepo
      .createQueryBuilder('agreement')
      .where('agreement.facilityId = :facilityId', { facilityId })
      .andWhere('agreement.status = :status', { status: PriceAgreementStatus.ACTIVE })
      .select('COUNT(DISTINCT agreement.itemCode)', 'count')
      .getRawOne();

    return { active, pending, expired, total, uniqueItemsCovered: parseInt(uniqueItems?.count || '0') };
  }
}
