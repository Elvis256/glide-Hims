import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { PatientProblem, ProblemStatus } from '../../database/entities/patient-problem.entity';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { CreateProblemDto, UpdateProblemDto, ProblemSearchDto, MarkResolvedDto } from './dto/problems.dto';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(PatientProblem)
    private readonly problemRepo: Repository<PatientProblem>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
  ) {}

  async create(facilityId: string, dto: CreateProblemDto, userId?: string) {
    const problem = this.problemRepo.create({
      ...dto,
      facilityId,
      diagnosedById: userId,
      lastReviewedAt: new Date(),
      lastReviewedById: userId,
    });
    return this.problemRepo.save(problem);
  }

  async findAll(facilityId: string, query: ProblemSearchDto) {
    const { patientId, status, search, page = 1, limit = 50 } = query;

    const qb = this.problemRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.diagnosis', 'diagnosis')
      .leftJoinAndSelect('p.patient', 'patient')
      .where('p.facilityId = :facilityId', { facilityId })
      .andWhere('p.deletedAt IS NULL');

    if (patientId) {
      qb.andWhere('p.patientId = :patientId', { patientId });
    }

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        `(diagnosis.name ILIKE :search OR diagnosis.icd10_code ILIKE :search OR p.custom_diagnosis ILIKE :search OR p.custom_icd_code ILIKE :search)`,
        { search: `%${search}%` },
      );
    }

    qb.orderBy('p.status', 'ASC')
      .addOrderBy('p.onsetDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Transform to include diagnosis info
    const transformed = data.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      patient: p.patient ? {
        id: p.patient.id,
        fullName: p.patient.fullName,
        mrn: p.patient.mrn,
      } : null,
      diagnosisId: p.diagnosisId,
      diagnosis: p.diagnosis?.name || p.customDiagnosis,
      icdCode: p.diagnosis?.icd10Code || p.customIcdCode,
      status: p.status,
      severity: p.severity,
      onsetDate: p.onsetDate,
      resolvedDate: p.resolvedDate,
      notes: p.notes,
      lastReviewedAt: p.lastReviewedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      data: transformed,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByPatient(patientId: string, status?: ProblemStatus) {
    const qb = this.problemRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.diagnosis', 'diagnosis')
      .where('p.patientId = :patientId', { patientId })
      .andWhere('p.deletedAt IS NULL');

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }

    qb.orderBy('p.status', 'ASC').addOrderBy('p.onsetDate', 'DESC');

    const data = await qb.getMany();

    return data.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      diagnosisId: p.diagnosisId,
      diagnosis: p.diagnosis?.name || p.customDiagnosis,
      icdCode: p.diagnosis?.icd10Code || p.customIcdCode,
      status: p.status,
      severity: p.severity,
      onsetDate: p.onsetDate,
      resolvedDate: p.resolvedDate,
      notes: p.notes,
      lastReviewedAt: p.lastReviewedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async findOne(id: string) {
    const problem = await this.problemRepo.findOne({
      where: { id, deletedAt: null as any },
      relations: ['diagnosis', 'patient'],
    });

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    return {
      id: problem.id,
      patientId: problem.patientId,
      patient: problem.patient ? {
        id: problem.patient.id,
        fullName: problem.patient.fullName,
        mrn: problem.patient.mrn,
      } : null,
      diagnosisId: problem.diagnosisId,
      diagnosis: problem.diagnosis?.name || problem.customDiagnosis,
      icdCode: problem.diagnosis?.icd10Code || problem.customIcdCode,
      status: problem.status,
      severity: problem.severity,
      onsetDate: problem.onsetDate,
      resolvedDate: problem.resolvedDate,
      notes: problem.notes,
      lastReviewedAt: problem.lastReviewedAt,
      createdAt: problem.createdAt,
      updatedAt: problem.updatedAt,
    };
  }

  async update(id: string, dto: UpdateProblemDto, userId?: string) {
    const problem = await this.problemRepo.findOneBy({ id });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    Object.assign(problem, dto, {
      lastReviewedAt: new Date(),
      lastReviewedById: userId,
    });

    return this.problemRepo.save(problem);
  }

  async markResolved(id: string, dto: MarkResolvedDto, userId?: string) {
    const problem = await this.problemRepo.findOneBy({ id });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    problem.status = ProblemStatus.RESOLVED;
    problem.resolvedDate = dto.resolvedDate ? new Date(dto.resolvedDate) : new Date();
    if (dto.notes) {
      problem.notes = dto.notes;
    }
    problem.lastReviewedAt = new Date();
    problem.lastReviewedById = userId;

    return this.problemRepo.save(problem);
  }

  async remove(id: string) {
    const problem = await this.problemRepo.findOneBy({ id });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }
    await this.problemRepo.softRemove(problem);
    return { message: 'Problem deleted' };
  }

  async getPatientStats(patientId: string) {
    const counts = await this.problemRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('p.patientId = :patientId', { patientId })
      .andWhere('p.deletedAt IS NULL')
      .groupBy('p.status')
      .getRawMany();

    const result = {
      total: 0,
      active: 0,
      chronic: 0,
      resolved: 0,
      inactive: 0,
    };

    counts.forEach((c) => {
      const count = parseInt(c.count, 10);
      result.total += count;
      if (c.status in result) {
        (result as any)[c.status] = count;
      }
    });

    return result;
  }
}
