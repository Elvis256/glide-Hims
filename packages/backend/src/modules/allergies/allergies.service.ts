import {
  BadRequestException,
  Injectable,
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

export interface UpdatePatientAllergyDto extends Partial<Omit<CreatePatientAllergyDto, 'patientId'>> {
  status?: AllergyStatus;
}

@Injectable()
export class AllergiesService {
  constructor(
    @InjectRepository(PatientAllergy)
    private readonly allergyRepo: Repository<PatientAllergy>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  private normalize(s: string): string {
    return (s || '').trim().toLowerCase();
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

  async create(dto: CreatePatientAllergyDto, userId?: string, tenantId?: string): Promise<PatientAllergy> {
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
    return this.allergyRepo.save(row);
  }

  async update(
    id: string,
    dto: UpdatePatientAllergyDto,
    tenantId?: string,
  ): Promise<PatientAllergy> {
    const row = await this.allergyRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!row) throw new NotFoundException('Allergy not found');
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
    return this.allergyRepo.save(row);
  }

  async inactivate(id: string, tenantId?: string): Promise<PatientAllergy> {
    return this.update(id, { status: 'inactive' }, tenantId);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const row = await this.allergyRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!row) throw new NotFoundException('Allergy not found');
    await this.allergyRepo.softRemove(row);
  }

  async findByIds(ids: string[], tenantId?: string): Promise<PatientAllergy[]> {
    if (!ids.length) return [];
    return this.allergyRepo.find({
      where: { id: In(ids), ...(tenantId ? { tenantId } : {}) },
    });
  }
}
