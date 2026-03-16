import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './clinical-notes.dto';

@Injectable()
export class ClinicalNotesService {
  constructor(
    @InjectRepository(ClinicalNote)
    private noteRepository: Repository<ClinicalNote>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
  ) {}

  async create(dto: CreateClinicalNoteDto, userId: string, tenantId?: string): Promise<ClinicalNote> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const note = this.noteRepository.create({
      ...dto,
      providerId: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedNote = await this.noteRepository.save(note);

    // Update encounter status
    if (encounter.status === EncounterStatus.WAITING) {
      encounter.status = EncounterStatus.IN_CONSULTATION;
      encounter.attendingProviderId = userId;
      await this.encounterRepository.save(encounter);
    }

    return savedNote;
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<ClinicalNote[]> {
    const where: any = { encounterId };
    if (tenantId) where.tenantId = tenantId;
    return this.noteRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['provider'],
    });
  }

  async findOne(id: string, tenantId?: string): Promise<ClinicalNote> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const note = await this.noteRepository.findOne({
      where,
      relations: ['encounter', 'provider'],
    });

    if (!note) {
      throw new NotFoundException('Clinical note not found');
    }

    return note;
  }

  async update(id: string, dto: UpdateClinicalNoteDto, tenantId?: string): Promise<ClinicalNote> {
    const note = await this.findOne(id, tenantId);
    Object.assign(note, dto);
    return this.noteRepository.save(note);
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    const note = await this.findOne(id, tenantId);
    await this.noteRepository.softRemove(note);
  }

  // Get patient's clinical history
  async getPatientHistory(patientId: string, limit = 20, tenantId?: string): Promise<ClinicalNote[]> {
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.encounter', 'encounter')
      .leftJoinAndSelect('note.provider', 'provider')
      .where('encounter.patient_id = :patientId', { patientId });

    if (tenantId) {
      qb.andWhere('note.tenant_id = :tenantId', { tenantId });
    }

    return qb
      .orderBy('note.created_at', 'DESC')
      .take(limit)
      .getMany();
  }
}
