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

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    // Check for duplicate code
    const existing = await this.supplierRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Supplier with code ${dto.code} already exists`);
    }

    const supplier = this.supplierRepo.create({
      ...dto,
      type: dto.type || SupplierType.GENERAL,
      status: SupplierStatus.ACTIVE,
    });

    return this.supplierRepo.save(supplier);
  }

  async findAll(facilityId: string, options: {
    type?: SupplierType;
    status?: SupplierStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, status, search, page = 1, limit = 50 } = options;

    const qb = this.supplierRepo.createQueryBuilder('supplier')
      .where('supplier.facilityId = :facilityId', { facilityId });

    if (type) {
      qb.andWhere('supplier.type = :type', { type });
    }
    if (status) {
      qb.andWhere('supplier.status = :status', { status });
    }
    if (search) {
      qb.andWhere('(supplier.name ILIKE :search OR supplier.code ILIKE :search)', { search: `%${search}%` });
    }

    const [data, total] = await qb
      .orderBy('supplier.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async findByCode(code: string): Promise<Supplier | null> {
    return this.supplierRepo.findOne({ where: { code } });
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const supplier = await this.findOne(id);
    await this.supplierRepo.softRemove(supplier);
  }

  async getActiveSuppliers(facilityId: string): Promise<Supplier[]> {
    return this.supplierRepo.find({
      where: { facilityId, status: SupplierStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async getDashboard(facilityId: string) {
    const [
      totalSuppliers,
      activeSuppliers,
      byType,
    ] = await Promise.all([
      this.supplierRepo.count({ where: { facilityId } }),
      this.supplierRepo.count({ where: { facilityId, status: SupplierStatus.ACTIVE } }),
      this.supplierRepo.createQueryBuilder('s')
        .select('s.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('s.facilityId = :facilityId', { facilityId })
        .groupBy('s.type')
        .getRawMany(),
    ]);

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers: totalSuppliers - activeSuppliers,
      byType,
    };
  }
}
