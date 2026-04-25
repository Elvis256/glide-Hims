import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  Diagnosis,
  COMMON_DIAGNOSES,
  DiagnosisCategory,
} from '../../database/entities/diagnosis.entity';
import { CreateDiagnosisDto, UpdateDiagnosisDto, DiagnosisSearchDto } from './dto/diagnosis.dto';

@Injectable()
export class DiagnosesService {
  constructor(
    @InjectRepository(Diagnosis)
    private diagnosisRepository: Repository<Diagnosis>,
  ) {}

  async create(dto: CreateDiagnosisDto, tenantId?: string): Promise<Diagnosis> {
    const findWhere: any = { icd10Code: dto.icd10Code };
    if (tenantId) findWhere.tenantId = tenantId;
    const existing = await this.diagnosisRepository.findOne({
      where: findWhere,
    });
    if (existing) throw new ConflictException('ICD-10 code already exists');

    const diagnosis = this.diagnosisRepository.create({
      ...dto,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.diagnosisRepository.save(diagnosis);
  }

  async findAll(
    query: DiagnosisSearchDto,
    tenantId?: string,
  ): Promise<{ data: Diagnosis[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const qb = this.diagnosisRepository.createQueryBuilder('diagnosis');

    if (tenantId) {
      qb.andWhere('diagnosis.tenant_id = :tenantId', { tenantId });
    }

    if (query.search) {
      qb.andWhere(
        '(diagnosis.icd10Code ILIKE :search OR diagnosis.name ILIKE :search OR diagnosis.shortName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.category) {
      qb.andWhere('diagnosis.category = :category', { category: query.category });
    }

    if (query.isNotifiable !== undefined) {
      qb.andWhere('diagnosis.isNotifiable = :isNotifiable', { isNotifiable: query.isNotifiable });
    }

    if (query.isChronic !== undefined) {
      qb.andWhere('diagnosis.isChronic = :isChronic', { isChronic: query.isChronic });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('diagnosis.isActive = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('diagnosis.isActive = true');
    }

    const [data, total] = await qb
      .orderBy('diagnosis.icd10Code', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId?: string): Promise<Diagnosis> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const diagnosis = await this.diagnosisRepository.findOne({ where });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    return diagnosis;
  }

  async findByCode(icd10Code: string, tenantId?: string): Promise<Diagnosis | null> {
    const where: any = { icd10Code };
    if (tenantId) where.tenantId = tenantId;
    return this.diagnosisRepository.findOne({ where });
  }

  async update(id: string, dto: UpdateDiagnosisDto, tenantId?: string): Promise<Diagnosis> {
    const diagnosis = await this.findOne(id, tenantId);
    Object.assign(diagnosis, dto);
    return this.diagnosisRepository.save(diagnosis);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const diagnosis = await this.findOne(id, tenantId);
    await this.diagnosisRepository.softRemove(diagnosis);
  }

  async seedCommonDiagnoses(tenantId?: string): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const diag of COMMON_DIAGNOSES) {
      const findWhere: any = { icd10Code: diag.icd10Code };
      if (tenantId) findWhere.tenantId = tenantId;
      const existing = await this.diagnosisRepository.findOne({
        where: findWhere,
      });
      if (existing) {
        skipped++;
        continue;
      }

      await this.diagnosisRepository.save(
        this.diagnosisRepository.create({
          ...diag,
          isActive: true,
          ...(tenantId ? { tenantId } : {}),
        }),
      );
      created++;
    }

    return { created, skipped };
  }

  async getCategories(tenantId?: string): Promise<string[]> {
    return Object.values(DiagnosisCategory);
  }

  async getNotifiableDiseases(tenantId?: string): Promise<Diagnosis[]> {
    const where: any = { isNotifiable: true, isActive: true };
    if (tenantId) where.tenantId = tenantId;
    return this.diagnosisRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getChronicConditions(tenantId?: string): Promise<Diagnosis[]> {
    const where: any = { isChronic: true, isActive: true };
    if (tenantId) where.tenantId = tenantId;
    return this.diagnosisRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }
}
