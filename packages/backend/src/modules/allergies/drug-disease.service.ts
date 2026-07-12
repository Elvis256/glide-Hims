import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireTenantId } from '../../common/utils/tenant.util';
import {
  DrugDiseaseInteraction,
  DrugDiseaseSeverity,
} from '../../database/entities/drug-disease-interaction.entity';
import { PatientChronicCondition } from '../../database/entities/patient-chronic-condition.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { SafetyAlert } from '../../database/entities/prescription-safety-override.entity';

export interface DrugDiseaseCheckInput {
  patientId: string;
  drugIds: string[];
  drugIdToName: Map<string, string>;
  encounterId?: string;
  tenantId?: string;
}

@Injectable()
export class DrugDiseaseService {
  private readonly logger = new Logger(DrugDiseaseService.name);

  constructor(
    @InjectRepository(DrugDiseaseInteraction)
    private readonly interactionRepo: Repository<DrugDiseaseInteraction>,
    @InjectRepository(PatientChronicCondition)
    private readonly chronicRepo: Repository<PatientChronicCondition>,
    @InjectRepository(ClinicalNote)
    private readonly clinicalNoteRepo: Repository<ClinicalNote>,
  ) {}

  /**
   * Check prescribed drugs against patient's chronic conditions + current encounter diagnoses.
   * Uses ICD-10 prefix matching so a rule for "E11" matches "E11.0", "E11.65" etc.
   */
  async checkDrugDiseaseInteractions(input: DrugDiseaseCheckInput): Promise<SafetyAlert[]> {
    const { patientId, drugIds, drugIdToName, encounterId, tenantId } = input;
    const tid = requireTenantId(tenantId);
    if (drugIds.length === 0) return [];

    // 1. Gather ICD-10 codes from chronic conditions
    const chronicConditions = await this.chronicRepo.find({
      where: {
        patientId,
        tenantId: tid,
      },
      relations: ['diagnosis'],
    });
    const activeChronics = chronicConditions.filter((c) =>
      ['active', 'controlled', 'uncontrolled'].includes(c.status),
    );

    const conditionCodes: { code: string; name: string }[] = activeChronics
      .filter((c) => c.diagnosis?.icd10Code)
      .map((c) => ({ code: c.diagnosis.icd10Code, name: c.diagnosis.name }));

    // 2. Gather ICD-10 codes from current encounter clinical notes
    if (encounterId) {
      const notes = await this.clinicalNoteRepo.find({
        where: { encounterId, tenantId: tid },
      });
      for (const note of notes) {
        if (Array.isArray(note.diagnoses)) {
          for (const d of note.diagnoses) {
            if (d.code) {
              conditionCodes.push({ code: d.code, name: d.description || d.code });
            }
          }
        }
      }
    }

    if (conditionCodes.length === 0) return [];

    // Deduplicate condition codes
    const uniqueCodes = [...new Map(conditionCodes.map((c) => [c.code, c])).values()];

    // 3. Query drug-disease interaction rules that match any of the patient's conditions.
    // We use prefix matching: rule icd10_code 'E11' matches patient code 'E11.65'.
    const alerts: SafetyAlert[] = [];

    const rules = await this.interactionRepo
      .createQueryBuilder('ddi')
      .where('ddi.is_active = :active', { active: true })
      .andWhere(
        '(ddi.drug_id IN (:...drugIds) OR ddi.drug_classification_id IS NOT NULL)',
        { drugIds },
      )
      .andWhere('ddi.tenant_id = :tenantId', { tenantId: tid })
      .getMany();

    for (const rule of rules) {
      // Check if any patient condition matches this rule's ICD-10 code (prefix match)
      const matchedCondition = uniqueCodes.find(
        (c) =>
          c.code === rule.icd10Code ||
          c.code.startsWith(rule.icd10Code + '.') ||
          c.code.startsWith(rule.icd10Code),
      );
      if (!matchedCondition) continue;

      // Determine which drug(s) this rule applies to
      const matchedDrugIds: string[] = [];
      if (rule.drugId && drugIds.includes(rule.drugId)) {
        matchedDrugIds.push(rule.drugId);
      }
      // If rule is classification-based, we include all drugIds (caller should refine)
      if (rule.drugClassificationId && matchedDrugIds.length === 0) {
        matchedDrugIds.push(...drugIds);
      }

      for (const drugId of matchedDrugIds) {
        alerts.push({
          kind: 'drug-disease',
          severity: rule.severity === DrugDiseaseSeverity.MINOR ? 'moderate' : rule.severity,
          drugId,
          drugName: drugIdToName.get(drugId) || 'drug',
          diagnosisCode: matchedCondition.code,
          diagnosisName: matchedCondition.name,
          description: rule.description,
          recommendation: rule.recommendation || undefined,
        });
      }
    }

    return alerts;
  }

  // --- CRUD for drug-disease interaction rules ---

  async create(
    data: Partial<DrugDiseaseInteraction>,
    tenantId?: string,
  ): Promise<DrugDiseaseInteraction> {
    const tid = requireTenantId(tenantId);
    const rule = this.interactionRepo.create({
      ...data,
      tenantId: tid,
    });
    return this.interactionRepo.save(rule);
  }

  async findAll(tenantId?: string): Promise<DrugDiseaseInteraction[]> {
    const tid = requireTenantId(tenantId);
    return this.interactionRepo.find({
      where: { tenantId: tid, isActive: true },
      order: { icd10Code: 'ASC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<DrugDiseaseInteraction> {
    const tid = requireTenantId(tenantId);
    const rule = await this.interactionRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!rule) throw new NotFoundException('Drug-disease interaction rule not found');
    return rule;
  }

  async findByDrug(drugId: string, tenantId?: string): Promise<DrugDiseaseInteraction[]> {
    const tid = requireTenantId(tenantId);
    return this.interactionRepo.find({
      where: { drugId, isActive: true, tenantId: tid },
    });
  }

  async findByDiagnosis(icd10Code: string, tenantId?: string): Promise<DrugDiseaseInteraction[]> {
    const tid = requireTenantId(tenantId);
    // Exact and prefix match
    return this.interactionRepo
      .createQueryBuilder('ddi')
      .where('ddi.is_active = :active', { active: true })
      .andWhere(
        '(ddi.icd10_code = :code OR :code LIKE ddi.icd10_code || \'%\')',
        { code: icd10Code },
      )
      .andWhere('ddi.tenant_id = :tenantId', { tenantId: tid })
      .getMany();
  }

  async update(
    id: string,
    data: Partial<DrugDiseaseInteraction>,
    tenantId?: string,
  ): Promise<DrugDiseaseInteraction> {
    const rule = await this.findOne(id, tenantId);
    Object.assign(rule, data);
    return this.interactionRepo.save(rule);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const rule = await this.findOne(id, tenantId);
    await this.interactionRepo.softRemove(rule);
  }
}
