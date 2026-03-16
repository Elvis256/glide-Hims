import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider, ProviderType, ProviderStatus } from '../../database/entities/provider.entity';
import { CreateProviderDto, UpdateProviderDto, ProviderSearchDto } from './dto/provider.dto';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  async create(dto: CreateProviderDto, tenantId?: string): Promise<Provider> {
    if (dto.licenseNumber) {
      const where: any = { licenseNumber: dto.licenseNumber };
      if (tenantId) where.tenantId = tenantId;
      const existing = await this.providerRepository.findOne({ where });
      if (existing) throw new ConflictException('License number already exists');
    }

    const provider = this.providerRepository.create({
      ...dto,
      status: ProviderStatus.ACTIVE,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.providerRepository.save(provider);
  }

  async findAll(query: ProviderSearchDto, tenantId?: string) {
    const qb = this.providerRepository.createQueryBuilder('provider')
      .leftJoinAndSelect('provider.facility', 'facility')
      .leftJoinAndSelect('provider.department', 'department')
      .leftJoinAndSelect('provider.user', 'user');

    if (query.search) {
      qb.andWhere(
        '(provider.fullName ILIKE :search OR provider.licenseNumber ILIKE :search OR provider.specialty ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.facilityId) {
      qb.andWhere('provider.facilityId = :facilityId', { facilityId: query.facilityId });
    }

    if (query.departmentId) {
      qb.andWhere('provider.departmentId = :departmentId', { departmentId: query.departmentId });
    }

    if (query.providerType) {
      qb.andWhere('provider.providerType = :providerType', { providerType: query.providerType });
    }

    if (query.specialty) {
      qb.andWhere('provider.specialty ILIKE :specialty', { specialty: `%${query.specialty}%` });
    }

    if (query.status) {
      qb.andWhere('provider.status = :status', { status: query.status });
    } else {
      qb.andWhere('provider.status = :status', { status: ProviderStatus.ACTIVE });
    }

    if (query.canPrescribe !== undefined) {
      qb.andWhere('provider.canPrescribe = :canPrescribe', { canPrescribe: query.canPrescribe });
    }

    if (query.canPerformSurgery !== undefined) {
      qb.andWhere('provider.canPerformSurgery = :canPerformSurgery', { canPerformSurgery: query.canPerformSurgery });
    }

    if (tenantId) {
      qb.andWhere('provider.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('provider.fullName', 'ASC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<Provider> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const provider = await this.providerRepository.findOne({
      where,
      relations: ['facility', 'department', 'user'],
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Provider | null> {
    const where: any = { userId };
    if (tenantId) where.tenantId = tenantId;
    return this.providerRepository.findOne({
      where,
      relations: ['facility', 'department'],
    });
  }

  async findByLicense(licenseNumber: string, tenantId?: string): Promise<Provider | null> {
    const where: any = { licenseNumber };
    if (tenantId) where.tenantId = tenantId;
    return this.providerRepository.findOne({ where });
  }

  async update(id: string, dto: UpdateProviderDto, tenantId?: string): Promise<Provider> {
    const provider = await this.findOne(id, tenantId);
    Object.assign(provider, dto);
    return this.providerRepository.save(provider);
  }

  async updateStatus(id: string, status: ProviderStatus, tenantId?: string): Promise<Provider> {
    const provider = await this.findOne(id, tenantId);
    provider.status = status;
    return this.providerRepository.save(provider);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const provider = await this.findOne(id, tenantId);
    await this.providerRepository.softRemove(provider);
  }

  async getProviderTypes(): Promise<string[]> {
    return Object.values(ProviderType);
  }

  async getSpecialties(facilityId?: string, tenantId?: string): Promise<string[]> {
    const qb = this.providerRepository.createQueryBuilder('provider')
      .select('DISTINCT provider.specialty', 'specialty')
      .where('provider.specialty IS NOT NULL');

    if (facilityId) {
      qb.andWhere('provider.facilityId = :facilityId', { facilityId });
    }

    if (tenantId) {
      qb.andWhere('provider.tenant_id = :tenantId', { tenantId });
    }

    const results = await qb.getRawMany();
    return results.map(r => r.specialty).filter(Boolean);
  }

  async getAvailableProviders(facilityId: string, date: Date, tenantId?: string): Promise<Provider[]> {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    
    const qb = this.providerRepository.createQueryBuilder('provider')
      .where('provider.facilityId = :facilityId', { facilityId })
      .andWhere('provider.status = :status', { status: ProviderStatus.ACTIVE })
      .andWhere('provider.availableDays @> :day', { day: JSON.stringify([dayOfWeek]) });

    if (tenantId) {
      qb.andWhere('provider.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('provider.fullName', 'ASC').getMany();
  }

  async getSurgeons(facilityId: string, tenantId?: string): Promise<Provider[]> {
    const where: any = {
      facilityId,
      canPerformSurgery: true,
      status: ProviderStatus.ACTIVE,
    };
    if (tenantId) where.tenantId = tenantId;
    return this.providerRepository.find({
      where,
      order: { fullName: 'ASC' },
    });
  }

  async getPrescribers(facilityId: string, tenantId?: string): Promise<Provider[]> {
    const where: any = {
      facilityId,
      canPrescribe: true,
      status: ProviderStatus.ACTIVE,
    };
    if (tenantId) where.tenantId = tenantId;
    return this.providerRepository.find({
      where,
      order: { fullName: 'ASC' },
    });
  }

  async checkLicenseExpiry(daysAhead: number = 30, tenantId?: string): Promise<Provider[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const qb = this.providerRepository.createQueryBuilder('provider')
      .where('provider.licenseExpiry <= :futureDate', { futureDate })
      .andWhere('provider.licenseExpiry >= :today', { today: new Date() })
      .andWhere('provider.status = :status', { status: ProviderStatus.ACTIVE });

    if (tenantId) {
      qb.andWhere('provider.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('provider.licenseExpiry', 'ASC').getMany();
  }
}
