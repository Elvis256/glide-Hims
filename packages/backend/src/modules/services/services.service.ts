import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { ServiceCategory, Service, ServicePrice, ServicePackage, ServiceTier } from '../../database/entities/service-category.entity';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto, CreateServiceDto, UpdateServiceDto, CreateServicePriceDto, CreateServicePackageDto } from './services.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ServiceCategory) private categoryRepo: Repository<ServiceCategory>,
    @InjectRepository(Service) private serviceRepo: Repository<Service>,
    @InjectRepository(ServicePrice) private priceRepo: Repository<ServicePrice>,
    @InjectRepository(ServicePackage) private packageRepo: Repository<ServicePackage>,
  ) {}

  // Categories
  async createCategory(dto: CreateServiceCategoryDto) {
    const exists = await this.categoryRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Category code already exists');
    return this.categoryRepo.save(this.categoryRepo.create(dto));
  }

  async findAllCategories() {
    return this.categoryRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async deleteCategory(id: string) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.categoryRepo.remove(cat);
    return { success: true };
  }

  // Services
  async createService(dto: CreateServiceDto) {
    const exists = await this.serviceRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Service code already exists');
    return this.serviceRepo.save(this.serviceRepo.create(dto));
  }

  async findAllServices(categoryId?: string, tier?: ServiceTier, includeInactive = false) {
    const query = this.serviceRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.category', 'c');
    if (!includeInactive) {
      query.where('s.isActive = true');
    }
    if (categoryId) query.andWhere('s.categoryId = :categoryId', { categoryId });
    if (tier) query.andWhere('s.tier = :tier', { tier });
    return query.orderBy('c.name', 'ASC').addOrderBy('s.name', 'ASC').getMany();
  }

  async findService(id: string) {
    const service = await this.serviceRepo.findOne({ where: { id }, relations: ['category'] });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const service = await this.findService(id);
    Object.assign(service, dto);
    return this.serviceRepo.save(service);
  }

  async deleteService(id: string) {
    const service = await this.findService(id);
    await this.serviceRepo.remove(service);
    return { success: true };
  }

  // Prices
  async createPrice(dto: CreateServicePriceDto) {
    return this.priceRepo.save(this.priceRepo.create(dto));
  }

  async getServicePrice(serviceId: string, tier: ServiceTier, facilityId?: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const price = await this.priceRepo.findOne({
      where: {
        serviceId,
        tier,
        effectiveFrom: LessThanOrEqual(new Date(today)),
        effectiveTo: Or(MoreThanOrEqual(new Date(today)), IsNull()),
        ...(facilityId ? { facilityId } : {}),
      },
      order: { effectiveFrom: 'DESC' },
    });
    if (price) return Number(price.price);
    const service = await this.findService(serviceId);
    return Number(service.basePrice);
  }

  // Packages
  async createPackage(dto: CreateServicePackageDto) {
    const exists = await this.packageRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Package code already exists');
    return this.packageRepo.save(this.packageRepo.create(dto));
  }

  async findAllPackages() {
    return this.packageRepo.find({ order: { name: 'ASC' } });
  }

  async updatePackage(id: string, dto: Partial<CreateServicePackageDto> & { isActive?: boolean }) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  async deletePackage(id: string) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return this.packageRepo.remove(pkg);
  }
}
