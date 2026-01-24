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

  async create(dto: CreateClinicalNoteDto, userId: string): Promise<ClinicalNote> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const note = this.noteRepository.create({
      ...dto,
      providerId: userId,
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

  async findByEncounter(encounterId: string): Promise<ClinicalNote[]> {
    return this.noteRepository.find({
      where: { encounterId },
      order: { createdAt: 'DESC' },
      relations: ['provider'],
    });
  }

  async findOne(id: string): Promise<ClinicalNote> {
    const note = await this.noteRepository.findOne({
      where: { id },
      relations: ['encounter', 'provider'],
    });

    if (!note) {
      throw new NotFoundException('Clinical note not found');
    }

    return note;
  }

  async update(id: string, dto: UpdateClinicalNoteDto): Promise<ClinicalNote> {
    const note = await this.findOne(id);
    Object.assign(note, dto);
    return this.noteRepository.save(note);
  }

  async delete(id: string): Promise<void> {
    const note = await this.findOne(id);
    await this.noteRepository.softRemove(note);
  }

  // Get patient's clinical history
  async getPatientHistory(patientId: string, limit = 20): Promise<ClinicalNote[]> {
    return this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.encounter', 'encounter')
      .leftJoinAndSelect('note.provider', 'provider')
      .where('encounter.patient_id = :patientId', { patientId })
      .orderBy('note.created_at', 'DESC')
      .take(limit)
      .getMany();
  }
}
