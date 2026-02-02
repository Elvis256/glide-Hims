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
    const where: any = { status: SupplierStatus.ACTIVE };
    if (facilityId && facilityId.trim() !== '') {
      where.facilityId = facilityId;
    }
    return this.supplierRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getDashboard(facilityId: string) {
    const hasFacility = facilityId && facilityId.trim() !== '';
    const whereClause = hasFacility ? { facilityId } : {};

    const [
      totalSuppliers,
      activeSuppliers,
      byType,
    ] = await Promise.all([
      this.supplierRepo.count({ where: whereClause }),
      this.supplierRepo.count({ where: { ...whereClause, status: SupplierStatus.ACTIVE } }),
      hasFacility
        ? this.supplierRepo.createQueryBuilder('s')
            .select('s.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('s.facilityId = :facilityId', { facilityId })
            .groupBy('s.type')
            .getRawMany()
        : this.supplierRepo.createQueryBuilder('s')
            .select('s.type', 'type')
            .addSelect('COUNT(*)', 'count')
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
