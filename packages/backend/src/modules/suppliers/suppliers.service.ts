import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Supplier, SupplierStatus, SupplierType } from '../../database/entities/supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto, tenantId?: string): Promise<Supplier> {
    // Check for duplicate code
    const where: any = { code: dto.code };
    if (tenantId) where.tenantId = tenantId;
    const existing = await this.supplierRepo.findOne({ where });
    if (existing) {
      throw new ConflictException(`Supplier with code ${dto.code} already exists`);
    }

    const supplier = this.supplierRepo.create({
      ...dto,
      type: dto.type || SupplierType.GENERAL,
      status: SupplierStatus.ACTIVE,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.supplierRepo.save(supplier);
  }

  async findAll(facilityId: string, options: {
    type?: SupplierType;
    status?: SupplierStatus;
    search?: string;
    page?: number;
    limit?: number;
  }, tenantId?: string) {
    const { type, status, search, page = 1, limit = 50 } = options;

    const qb = this.supplierRepo.createQueryBuilder('supplier');

    let hasWhere = false;
    if (facilityId && facilityId.trim() !== '') {
      qb.where('supplier.facilityId = :facilityId', { facilityId });
      hasWhere = true;
    }

    if (type) {
      if (hasWhere) {
        qb.andWhere('supplier.type = :type', { type });
      } else {
        qb.where('supplier.type = :type', { type });
        hasWhere = true;
      }
    }
    if (status) {
      qb.andWhere('supplier.status = :status', { status });
    }
    if (search) {
      qb.andWhere('(supplier.name ILIKE :search OR supplier.code ILIKE :search)', { search: `%${search}%` });
    }

    if (tenantId) {
      qb.andWhere('supplier.tenant_id = :tenantId', { tenantId });
    }

    const [data, total] = await qb
      .orderBy('supplier.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId?: string): Promise<Supplier> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const supplier = await this.supplierRepo.findOne({ where });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async findByCode(code: string, tenantId?: string): Promise<Supplier | null> {
    const where: any = { code };
    if (tenantId) where.tenantId = tenantId;
    return this.supplierRepo.findOne({ where });
  }

  async update(id: string, dto: UpdateSupplierDto, tenantId?: string): Promise<Supplier> {
    const supplier = await this.findOne(id, tenantId);
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const supplier = await this.findOne(id, tenantId);
    await this.supplierRepo.softRemove(supplier);
  }

  async getActiveSuppliers(facilityId: string, tenantId?: string): Promise<Supplier[]> {
    const where: any = { status: SupplierStatus.ACTIVE };
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.supplierRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getDashboard(facilityId: string, tenantId?: string) {
    const hasFacility = facilityId && facilityId.trim() !== '';
    const whereClause: any = hasFacility ? { facilityId } : {};
    if (tenantId) whereClause.tenantId = tenantId;

    const [
      totalSuppliers,
      activeSuppliers,
      byType,
    ] = await Promise.all([
      this.supplierRepo.count({ where: whereClause }),
      this.supplierRepo.count({ where: { ...whereClause, status: SupplierStatus.ACTIVE } }),
      (() => {
        const qb = this.supplierRepo.createQueryBuilder('s')
          .select('s.type', 'type')
          .addSelect('COUNT(*)', 'count');
        if (hasFacility) {
          qb.where('s.facilityId = :facilityId', { facilityId });
        }
        if (tenantId) {
          if (hasFacility) {
            qb.andWhere('s.tenant_id = :tenantId', { tenantId });
          } else {
            qb.where('s.tenant_id = :tenantId', { tenantId });
          }
        }
        return qb.groupBy('s.type').getRawMany();
      })(),
    ]);

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers: totalSuppliers - activeSuppliers,
      byType,
    };
  }
}
