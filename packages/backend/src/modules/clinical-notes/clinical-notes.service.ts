import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './clinical-notes.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

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
    const tid = requireTenantId(tenantId);
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId, tenantId: tid },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const note = this.noteRepository.create({
      ...dto,
      providerId: userId,
      tenantId: tid,
    });

    const savedNote = await this.noteRepository.save(note);

    // Note: Encounter status is managed by EncountersService.
    // Clinical note creation should not have side effects on encounter status.

    return savedNote;
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<ClinicalNote[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { encounterId };
    where.tenantId = tid;
    return this.noteRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['provider'],
    });
  }

  async findOne(id: string, tenantId?: string): Promise<ClinicalNote> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
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
    const tid = requireTenantId(tenantId);
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.encounter', 'encounter')
      .leftJoinAndSelect('note.provider', 'provider')
      .where('encounter.patient_id = :patientId', { patientId });

    qb.andWhere('note.tenant_id = :tenantId', { tenantId: tid });

    // `note.createdAt`, the PROPERTY, not `note.created_at`, the column.
    // TypeORM only resolves the orderBy to a column when take() is combined
    // with a join — it then builds a DISTINCT subquery through
    // createOrderByCombinedWithSelectExpression, fails to find a property
    // called created_at and dereferences undefined: "Cannot read properties of
    // undefined (reading 'databaseName')". This endpoint answered 500 for every
    // patient. Elsewhere the snake_case form is harmless because there is no
    // take() alongside the join, which is why only this one broke.
    return qb.orderBy('note.createdAt', 'DESC').take(limit).getMany();
  }
}
