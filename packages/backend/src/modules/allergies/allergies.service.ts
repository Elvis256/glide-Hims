import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  PatientAllergy,
  AllergyStatus,
  AllergyType,
  AllergyCategory,
  AllergyCriticality,
  AllergySeverity,
  AllergyVerification,
  AllergySource,
} from '../../database/entities/patient-allergy.entity';
import { Patient } from '../../database/entities/patient.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

export interface CreatePatientAllergyDto {
  patientId: string;
  allergen: string;
  allergenCode?: string;
  codeSystem?: string;
  type?: AllergyType;
  category?: AllergyCategory;
  criticality?: AllergyCriticality;
  severity?: AllergySeverity;
  reaction?: string;
  verification?: AllergyVerification;
  source?: AllergySource;
  onsetDate?: string | Date;
  notes?: string;
}

export interface UpdatePatientAllergyDto extends Partial<
  Omit<CreatePatientAllergyDto, 'patientId'>
> {
  status?: AllergyStatus;
}

@Injectable()
export class AllergiesService {
  private readonly logger = new Logger(AllergiesService.name);

  constructor(
    @InjectRepository(PatientAllergy)
    private readonly allergyRepo: Repository<PatientAllergy>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly auditLogService: AuditLogService,
  ) {}

  private normalize(s: string): string {
    return (s || '').trim().toLowerCase();
  }

  private async loadScoped(
    id: string,
    tenantId?: string,
    patientId?: string,
  ): Promise<PatientAllergy> {
    const row = await this.allergyRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!row) throw new NotFoundException('Allergy not found');
    if (patientId && row.patientId !== patientId) {
      throw new ForbiddenException('Allergy does not belong to this patient');
    }
    return row;
  }

  private async writeAudit(
    action: string,
    row: PatientAllergy,
    userId?: string,
    tenantId?: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditLogService.log({
        userId,
        action,
        entityType: 'PatientAllergy',
        entityId: row.id,
        newValue: {
          patientId: row.patientId,
          allergen: row.allergen,
          status: row.status,
          criticality: row.criticality,
          severity: row.severity,
          ...(extra || {}),
        },
        ...(tenantId ? { tenantId } : {}),
      });
    } catch (err: any) {
      this.logger.error(`Audit log failed for allergy ${row.id}: ${err?.message || err}`);
    }
  }

  async list(patientId: string, tenantId?: string): Promise<PatientAllergy[]> {
    return this.allergyRepo.find({
      where: { patientId, ...(tenantId ? { tenantId } : {}) },
      order: { recordedAt: 'DESC' },
    });
  }

  /**
   * Returns the active allergens for a patient as normalized strings,
   * suitable for passing into DrugManagementService.checkAllergyRisk.
   * Includes both the raw allergen name and the coded value (if present)
   * to maximise match probability against the drug-classification table.
   */
  async getActiveAllergens(patientId: string, tenantId?: string): Promise<string[]> {
    const rows = await this.allergyRepo.find({
      where: { patientId, status: 'active', ...(tenantId ? { tenantId } : {}) },
    });
    const out = new Set<string>();
    for (const r of rows) {
      if (r.allergen) out.add(r.allergen);
      if (r.allergenNormalized) out.add(r.allergenNormalized);
      if (r.allergenCode) out.add(r.allergenCode);
    }
    return Array.from(out);
  }

  /**
   * Returns full active allergy rows — used by safety helper to attach
   * matched allergy IDs to override audit records.
   */
  async getActiveAllergies(patientId: string, tenantId?: string): Promise<PatientAllergy[]> {
    return this.allergyRepo.find({
      where: { patientId, status: 'active', ...(tenantId ? { tenantId } : {}) },
    });
  }

  async create(
    dto: CreatePatientAllergyDto,
    userId?: string,
    tenantId?: string,
  ): Promise<PatientAllergy> {
    if (!dto.allergen?.trim()) {
      throw new BadRequestException('allergen is required');
    }
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const normalized = this.normalize(dto.allergen);

    const existing = await this.allergyRepo.findOne({
      where: {
        patientId: dto.patientId,
        allergenNormalized: normalized,
        status: 'active',
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (existing) return existing;

    const row = this.allergyRepo.create({
      patientId: dto.patientId,
      allergen: dto.allergen.trim(),
      allergenNormalized: normalized,
      allergenCode: dto.allergenCode,
      codeSystem: dto.codeSystem,
      type: dto.type ?? 'allergy',
      category: dto.category ?? 'medication',
      criticality: dto.criticality ?? 'unable-to-assess',
      severity: dto.severity,
      reaction: dto.reaction,
      verification: dto.verification ?? 'unconfirmed',
      source: dto.source ?? 'patient-reported',
      onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : undefined,
      notes: dto.notes,
      recordedById: userId,
      recordedAt: new Date(),
      status: 'active',
      ...(tenantId ? { tenantId } : {}),
    });
    const saved = await this.allergyRepo.save(row);
    await this.writeAudit('ALLERGY_CREATED', saved, userId, tenantId);
    return saved;
  }

  async update(
    id: string,
    dto: UpdatePatientAllergyDto,
    tenantId?: string,
    patientId?: string,
    userId?: string,
  ): Promise<PatientAllergy> {
    const row = await this.loadScoped(id, tenantId, patientId);
    const before = {
      allergen: row.allergen,
      status: row.status,
      criticality: row.criticality,
      severity: row.severity,
    };
    if (dto.allergen) {
      row.allergen = dto.allergen.trim();
      row.allergenNormalized = this.normalize(dto.allergen);
    }
    Object.assign(row, {
      allergenCode: dto.allergenCode ?? row.allergenCode,
      codeSystem: dto.codeSystem ?? row.codeSystem,
      type: dto.type ?? row.type,
      category: dto.category ?? row.category,
      criticality: dto.criticality ?? row.criticality,
      severity: dto.severity ?? row.severity,
      reaction: dto.reaction ?? row.reaction,
      status: dto.status ?? row.status,
      verification: dto.verification ?? row.verification,
      source: dto.source ?? row.source,
      onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : row.onsetDate,
      notes: dto.notes ?? row.notes,
    });
    const saved = await this.allergyRepo.save(row);
    await this.writeAudit('ALLERGY_UPDATED', saved, userId, tenantId, { before });
    return saved;
  }

  async inactivate(
    id: string,
    tenantId?: string,
    patientId?: string,
    userId?: string,
  ): Promise<PatientAllergy> {
    return this.update(id, { status: 'inactive' }, tenantId, patientId, userId);
  }

  async remove(id: string, tenantId?: string, patientId?: string, userId?: string): Promise<void> {
    const row = await this.loadScoped(id, tenantId, patientId);
    await this.allergyRepo.softRemove(row);
    await this.writeAudit('ALLERGY_DELETED', row, userId, tenantId);
  }

  async findByIds(ids: string[], tenantId?: string): Promise<PatientAllergy[]> {
    if (!ids.length) return [];
    return this.allergyRepo.find({
      where: { id: In(ids), ...(tenantId ? { tenantId } : {}) },
    });
  }
}
