import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Diagnosis, COMMON_DIAGNOSES, DiagnosisCategory } from '../../database/entities/diagnosis.entity';
import { CreateDiagnosisDto, UpdateDiagnosisDto, DiagnosisSearchDto } from './dto/diagnosis.dto';

@Injectable()
export class DiagnosesService {
  constructor(
    @InjectRepository(Diagnosis)
    private diagnosisRepository: Repository<Diagnosis>,
  ) {}

  async create(dto: CreateDiagnosisDto): Promise<Diagnosis> {
    const existing = await this.diagnosisRepository.findOne({
      where: { icd10Code: dto.icd10Code },
    });
    if (existing) throw new ConflictException('ICD-10 code already exists');

    const diagnosis = this.diagnosisRepository.create({
      ...dto,
      isActive: true,
    });
    return this.diagnosisRepository.save(diagnosis);
  }

  async findAll(query: DiagnosisSearchDto) {
    const qb = this.diagnosisRepository.createQueryBuilder('diagnosis');

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

    return qb.orderBy('diagnosis.icd10Code', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Diagnosis> {
    const diagnosis = await this.diagnosisRepository.findOne({ where: { id } });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    return diagnosis;
  }

  async findByCode(icd10Code: string): Promise<Diagnosis | null> {
    return this.diagnosisRepository.findOne({ where: { icd10Code } });
  }

  async update(id: string, dto: UpdateDiagnosisDto): Promise<Diagnosis> {
    const diagnosis = await this.findOne(id);
    Object.assign(diagnosis, dto);
    return this.diagnosisRepository.save(diagnosis);
  }

  async remove(id: string): Promise<void> {
    const diagnosis = await this.findOne(id);
    await this.diagnosisRepository.softRemove(diagnosis);
  }

  async seedCommonDiagnoses(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const diag of COMMON_DIAGNOSES) {
      const existing = await this.diagnosisRepository.findOne({
        where: { icd10Code: diag.icd10Code },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await this.diagnosisRepository.save(
        this.diagnosisRepository.create({
          ...diag,
          isActive: true,
        }),
      );
      created++;
    }

    return { created, skipped };
  }

  async getCategories(): Promise<string[]> {
    return Object.values(DiagnosisCategory);
  }

  async getNotifiableDiseases(): Promise<Diagnosis[]> {
    return this.diagnosisRepository.find({
      where: { isNotifiable: true, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getChronicConditions(): Promise<Diagnosis[]> {
    return this.diagnosisRepository.find({
      where: { isChronic: true, isActive: true },
      order: { name: 'ASC' },
    });
  }
}
