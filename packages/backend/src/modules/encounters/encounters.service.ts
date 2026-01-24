import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { Encounter, EncounterStatus, EncounterType } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { CreateEncounterDto, UpdateEncounterDto, EncounterQueryDto } from './encounters.dto';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  private async generateVisitNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const lastEncounter = await this.encounterRepository
      .createQueryBuilder('encounter')
      .where('encounter.visit_number LIKE :prefix', { prefix: `V${datePrefix}%` })
      .orderBy('encounter.visit_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastEncounter) {
      const lastSeq = parseInt(lastEncounter.visitNumber.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `V${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  private async getNextQueueNumber(facilityId: string, departmentId?: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.encounterRepository
      .createQueryBuilder('encounter')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today });

    if (departmentId) {
      query.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    const count = await query.getCount();
    return count + 1;
  }

  async create(dto: CreateEncounterDto, userId: string): Promise<Encounter> {
    // Verify patient exists
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Check for active encounter
    const activeEncounter = await this.encounterRepository.findOne({
      where: {
        patientId: dto.patientId,
        status: EncounterStatus.REGISTERED,
      },
    });

    if (activeEncounter && dto.type === EncounterType.OPD) {
      throw new BadRequestException('Patient already has an active OPD encounter');
    }

    const visitNumber = await this.generateVisitNumber();
    const queueNumber = await this.getNextQueueNumber(dto.facilityId, dto.departmentId);

    const encounter = this.encounterRepository.create({
      ...dto,
      visitNumber,
      queueNumber,
      createdById: userId,
      status: EncounterStatus.REGISTERED,
    });

    return this.encounterRepository.save(encounter);
  }

  async findAll(query: EncounterQueryDto): Promise<{ data: Encounter[]; total: number }> {
    const { 
      search, 
      status, 
      type, 
      facilityId, 
      departmentId,
      patientId,
      dateFrom,
      dateTo,
      page = 1, 
      limit = 20 
    } = query;

    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.attendingProvider', 'provider')
      .leftJoinAndSelect('encounter.department', 'department');

    if (search) {
      qb.andWhere(
        '(encounter.visit_number ILIKE :search OR patient.full_name ILIKE :search OR patient.mrn ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (status) {
      qb.andWhere('encounter.status = :status', { status });
    }

    if (type) {
      qb.andWhere('encounter.type = :type', { type });
    }

    if (facilityId) {
      qb.andWhere('encounter.facility_id = :facilityId', { facilityId });
    }

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    if (patientId) {
      qb.andWhere('encounter.patient_id = :patientId', { patientId });
    }

    if (dateFrom) {
      qb.andWhere('encounter.created_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('encounter.created_at <= :dateTo', { dateTo });
    }

    qb.orderBy('encounter.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({
      where: { id },
      relations: ['patient', 'facility', 'department', 'attendingProvider', 'createdBy'],
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    return encounter;
  }

  async findByVisitNumber(visitNumber: string): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({
      where: { visitNumber },
      relations: ['patient', 'facility', 'department', 'attendingProvider'],
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    return encounter;
  }

  async update(id: string, dto: UpdateEncounterDto): Promise<Encounter> {
    const encounter = await this.findOne(id);
    Object.assign(encounter, dto);
    return this.encounterRepository.save(encounter);
  }

  async updateStatus(id: string, status: EncounterStatus, providerId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id);
    
    encounter.status = status;
    
    if (providerId && status === EncounterStatus.IN_CONSULTATION) {
      encounter.attendingProviderId = providerId;
    }

    if ([EncounterStatus.COMPLETED, EncounterStatus.DISCHARGED].includes(status)) {
      encounter.endTime = new Date();
    }

    return this.encounterRepository.save(encounter);
  }

  async getQueue(facilityId: string, departmentId?: string): Promise<Encounter[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [
          EncounterStatus.REGISTERED,
          EncounterStatus.TRIAGE,
          EncounterStatus.WAITING,
        ],
      })
      .andWhere('DATE(encounter.created_at) = CURRENT_DATE');

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    qb.orderBy('encounter.queue_number', 'ASC');

    return qb.getMany();
  }

  async getTodayStats(facilityId: string): Promise<{
    total: number;
    waiting: number;
    inConsultation: number;
    completed: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseQuery = this.encounterRepository
      .createQueryBuilder('encounter')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today });

    const total = await baseQuery.getCount();

    const waiting = await baseQuery
      .clone()
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [EncounterStatus.REGISTERED, EncounterStatus.TRIAGE, EncounterStatus.WAITING],
      })
      .getCount();

    const inConsultation = await baseQuery
      .clone()
      .andWhere('encounter.status = :status', { status: EncounterStatus.IN_CONSULTATION })
      .getCount();

    const completed = await baseQuery
      .clone()
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [EncounterStatus.COMPLETED, EncounterStatus.DISCHARGED],
      })
      .getCount();

    return { total, waiting, inConsultation, completed };
  }

  async delete(id: string): Promise<void> {
    const encounter = await this.findOne(id);
    await this.encounterRepository.softRemove(encounter);
  }
}
