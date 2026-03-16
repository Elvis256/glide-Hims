import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateVitalDto, UpdateVitalDto } from './vitals.dto';

@Injectable()
export class VitalsService {
  constructor(
    @InjectRepository(Vital)
    private vitalRepository: Repository<Vital>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
  ) {}

  private calculateBMI(weight: number, heightCm: number): number | null {
    if (!weight || !heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weight / (heightM * heightM)) * 10) / 10;
  }

  async create(dto: CreateVitalDto, userId: string, tenantId?: string): Promise<Vital> {
    // Verify encounter exists
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    // Calculate BMI if height and weight provided
    let bmi = dto.bmi;
    if (!bmi && dto.weight && dto.height) {
      bmi = this.calculateBMI(dto.weight, dto.height) ?? undefined;
    }

    const vital = this.vitalRepository.create({
      ...dto,
      bmi,
      recordedById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedVital = await this.vitalRepository.save(vital);

    // Update encounter status to TRIAGE if it was REGISTERED
    if (encounter.status === EncounterStatus.REGISTERED) {
      encounter.status = EncounterStatus.WAITING;
      await this.encounterRepository.save(encounter);
    }

    return savedVital;
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<Vital[]> {
    const where: any = { encounterId };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalRepository.find({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findLatestByEncounter(encounterId: string, tenantId?: string): Promise<Vital | null> {
    const where: any = { encounterId };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalRepository.findOne({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findOne(id: string, tenantId?: string): Promise<Vital> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const vital = await this.vitalRepository.findOne({
      where,
      relations: ['encounter', 'recordedBy'],
    });

    if (!vital) {
      throw new NotFoundException('Vital record not found');
    }

    return vital;
  }

  async update(id: string, dto: UpdateVitalDto): Promise<Vital> {
    const vital = await this.findOne(id);

    // Recalculate BMI if height or weight changed
    const weight = dto.weight ?? vital.weight;
    const height = dto.height ?? vital.height;
    const bmi = this.calculateBMI(weight, height);

    Object.assign(vital, dto, { bmi });
    return this.vitalRepository.save(vital);
  }

  async delete(id: string): Promise<void> {
    const vital = await this.findOne(id);
    await this.vitalRepository.softRemove(vital);
  }

  // Get patient's vital history across encounters
  async getPatientVitalHistory(patientId: string, limit = 10, tenantId?: string): Promise<Vital[]> {
    const qb = this.vitalRepository
      .createQueryBuilder('vital')
      .leftJoinAndSelect('vital.encounter', 'encounter')
      .where('encounter.patient_id = :patientId', { patientId });

    if (tenantId) {
      qb.andWhere('vital.tenant_id = :tenantId', { tenantId });
    }

    return qb
      .orderBy('vital.recordedAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
