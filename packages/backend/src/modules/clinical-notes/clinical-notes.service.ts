import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './clinical-notes.dto';

@Injectable()
export class ClinicalNotesService {
  constructor(
    @InjectRepository(ClinicalNote)
    private noteRepository: Repository<ClinicalNote>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
  ) {}

  // Roles that are permitted to amend/delete another author's clinical note.
  // Match against the exact role slug — substring/`includes('admin')` is
  // unsafe because role names like `admin_assistant` would qualify.
  private static readonly NOTE_ADMIN_ROLES = new Set<string>([
    'system_admin',
    'super_admin',
    'tenant_admin',
    'hospital_admin',
    'clinical_admin',
    'medical_director',
  ]);

  private assertOwnerOrAdmin(note: ClinicalNote, userId: string, roles: string[] = []): void {
    const isAdmin = roles.some((r) =>
      ClinicalNotesService.NOTE_ADMIN_ROLES.has(String(r).toLowerCase()),
    );
    if (note.providerId !== userId && !isAdmin) {
      throw new ForbiddenException('Only the note author or an admin can modify this note');
    }
  }

  async create(
    dto: CreateClinicalNoteDto,
    userId: string,
    tenantId?: string,
  ): Promise<ClinicalNote> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
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

    // Note: Encounter status is managed by EncountersService.
    // Clinical note creation should not have side effects on encounter status.

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

  async update(
    id: string,
    dto: UpdateClinicalNoteDto,
    userId: string,
    roles: string[] = [],
    tenantId?: string,
  ): Promise<ClinicalNote> {
    const note = await this.findOne(id, tenantId);
    this.assertOwnerOrAdmin(note, userId, roles);

    // Save edit history for audit trail
    const previousSnapshot = {
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      diagnoses: note.diagnoses,
      editedAt: new Date().toISOString(),
      editedById: userId,
    };
    const editHistory = Array.isArray(note.editHistory) ? [...note.editHistory] : [];
    editHistory.push(previousSnapshot);

    Object.assign(note, dto, {
      editHistory,
      lastEditedById: userId,
      lastEditedAt: new Date(),
    });
    return this.noteRepository.save(note);
  }

  async delete(id: string, userId: string, roles: string[] = [], tenantId?: string): Promise<void> {
    const note = await this.findOne(id, tenantId);
    this.assertOwnerOrAdmin(note, userId, roles);
    await this.noteRepository.softRemove(note);
  }

  // Get patient's clinical history
  async getPatientHistory(
    patientId: string,
    limit = 20,
    tenantId?: string,
  ): Promise<ClinicalNote[]> {
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.encounter', 'encounter')
      .leftJoinAndSelect('note.provider', 'provider')
      .where('encounter.patient_id = :patientId', { patientId });

    if (tenantId) {
      qb.andWhere('note.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('note.created_at', 'DESC').take(limit).getMany();
  }
}
