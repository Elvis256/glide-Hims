import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import {
  ServiceCategory,
  Service,
  ServicePrice,
  ServicePackage,
  ServiceTier,
} from '../../database/entities/service-category.entity';
import { ServiceConsumable } from '../../database/entities/service-consumable.entity';
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateServicePriceDto,
  CreateServicePackageDto,
} from './services.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceCategory) private categoryRepo: Repository<ServiceCategory>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    @InjectRepository(ServicePackage) private packageRepo: Repository<ServicePackage>,
    @InjectRepository(ServiceConsumable) private consumableRepo: Repository<ServiceConsumable>,
  ) {}

  // Categories
  async createCategory(dto: CreateServiceCategoryDto, tenantId?: string) {
    const exists = await this.categoryRepo.findOne({
      where: { code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (exists) throw new ConflictException('Category code already exists');
    return this.categoryRepo.save(
      this.categoryRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) }),
    );
  }

  async findAllCategories(tenantId?: string) {
    return this.categoryRepo.find({
      where: { isActive: true, ...(tenantId ? { tenantId } : {}) },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto, tenantId?: string) {
    const cat = await this.categoryRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!cat) throw new NotFoundException('Category not found');
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async deleteCategory(id: string, tenantId?: string) {
    const cat = await this.categoryRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!cat) throw new NotFoundException('Category not found');
    await this.categoryRepo.remove(cat);
    return { success: true };
  }

  // Services
  async createService(dto: CreateServiceDto, tenantId?: string) {
    const exists = await this.serviceRepo.findOne({
      where: { code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (exists) throw new ConflictException('Service code already exists');
    return this.serviceRepo.save(
      this.serviceRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) }),
    );
  }

  async findAllServices(
    categoryId?: string,
    tier?: ServiceTier,
    includeInactive = false,
    tenantId?: string,
  ) {
    const query = this.serviceRepo.createQueryBuilder('s').leftJoinAndSelect('s.category', 'c');
    if (!includeInactive) {
      query.where('s.isActive = true');
    }
    if (categoryId) query.andWhere('s.categoryId = :categoryId', { categoryId });
    if (tier) query.andWhere('s.tier = :tier', { tier });
    if (tenantId) {
      query.andWhere('s.tenant_id = :tenantId', { tenantId });
    }
    return query.orderBy('c.name', 'ASC').addOrderBy('s.name', 'ASC').getMany();
  }

  async findService(id: string, tenantId?: string) {
    const service = await this.serviceRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['category'],
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async updateService(id: string, dto: UpdateServiceDto, tenantId?: string) {
    const service = await this.findService(id, tenantId);
    Object.assign(service, dto);
    return this.serviceRepo.save(service);
  }

  async deleteService(id: string, tenantId?: string) {
    const service = await this.findService(id, tenantId);
    await this.serviceRepo.remove(service);
    return { success: true };
  }

  // Prices
  async createPrice(dto: CreateServicePriceDto, tenantId?: string) {
    return this.priceRepo.save(
      this.priceRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) }),
    );
  }

  async getServicePrice(
    serviceId: string,
    tier: ServiceTier,
    facilityId?: string,
    tenantId?: string,
  ): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const price = await this.priceRepo.findOne({
      where: {
        serviceId,
        tier,
        effectiveFrom: LessThanOrEqual(new Date(today)),
        effectiveTo: Or(MoreThanOrEqual(new Date(today)), IsNull()),
        ...(facilityId ? { facilityId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { effectiveFrom: 'DESC' },
    });
    if (price) return Number(price.price);
    const service = await this.findService(serviceId, tenantId);
    return Number(service.basePrice);
  }

  // Packages
  async createPackage(dto: CreateServicePackageDto, tenantId?: string) {
    const exists = await this.packageRepo.findOne({
      where: { code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (exists) throw new ConflictException('Package code already exists');
    return this.packageRepo.save(
      this.packageRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) }),
    );
  }

  async findAllPackages(tenantId?: string) {
    return this.packageRepo.find({
      where: { ...(tenantId ? { tenantId } : {}) },
      order: { name: 'ASC' },
    });
  }

  async updatePackage(
    id: string,
    dto: Partial<CreateServicePackageDto> & { isActive?: boolean },
    tenantId?: string,
  ) {
    const pkg = await this.packageRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  async deletePackage(id: string, tenantId?: string) {
    const pkg = await this.packageRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return this.packageRepo.remove(pkg);
  }

  // ─── Service Consumables (auto-deduct items when service is rendered) ───

  async listConsumables(serviceId: string, tenantId?: string) {
    return this.consumableRepo.find({
      where: { serviceId, ...(tenantId ? { tenantId } : {}) },
      relations: ['item'],
      order: { createdAt: 'ASC' },
    });
  }

  async addConsumable(
    serviceId: string,
    dto: { itemId: string; quantity: number; isOptional?: boolean; notes?: string },
    tenantId?: string,
  ) {
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!service) throw new NotFoundException('Service not found');
    const exists = await this.consumableRepo.findOne({
      where: { serviceId, itemId: dto.itemId, ...(tenantId ? { tenantId } : {}) },
    });
    if (exists) throw new ConflictException('Item already linked to this service');
    return this.consumableRepo.save(
      this.consumableRepo.create({
        serviceId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        isOptional: dto.isOptional ?? false,
        notes: dto.notes,
        ...(tenantId ? { tenantId } : {}),
      }),
    );
  }

  async updateConsumable(
    id: string,
    dto: Partial<{ quantity: number; isOptional: boolean; notes: string }>,
    tenantId?: string,
  ) {
    const row = await this.consumableRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!row) throw new NotFoundException('Consumable not found');
    Object.assign(row, dto);
    return this.consumableRepo.save(row);
  }

  async deleteConsumable(id: string, tenantId?: string) {
    const row = await this.consumableRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!row) throw new NotFoundException('Consumable not found');
    return this.consumableRepo.remove(row);
  }

  /** Lookup consumables by service code — used by billing for auto-deduction. */
  async getConsumablesByCode(serviceCode: string, tenantId?: string) {
    const svc = await this.serviceRepo.findOne({
      where: { code: serviceCode, ...(tenantId ? { tenantId } : {}) },
    });
    if (!svc) return [];
    return this.consumableRepo.find({
      where: { serviceId: svc.id, ...(tenantId ? { tenantId } : {}) },
      relations: ['item'],
    });
  }
}
