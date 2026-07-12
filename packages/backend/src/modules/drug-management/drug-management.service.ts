import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  DrugClassification,
  DrugInteraction,
  DrugAllergyClass,
  DrugSchedule,
  TherapeuticClass,
} from '../../database/entities/drug-classification.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class DrugManagementService {
  constructor(
    @InjectRepository(DrugClassification)
    private classificationRepo: Repository<DrugClassification>,
    @InjectRepository(DrugInteraction)
    private interactionRepo: Repository<DrugInteraction>,
    @InjectRepository(DrugAllergyClass)
    private allergyClassRepo: Repository<DrugAllergyClass>,
  ) {}

  // ==================== DRUG CLASSIFICATION ====================

  async createClassification(
    data: Partial<DrugClassification>,
    tenantId?: string,
  ): Promise<DrugClassification> {
    // Set derived flags
    if (data.schedule === DrugSchedule.SCHEDULE_I || data.schedule === DrugSchedule.SCHEDULE_II) {
      data.isControlled = true;
      data.requiresDoubleCheck = true;
    }

    data.tenantId = requireTenantId(tenantId);

    const classification = this.classificationRepo.create(data);
    return this.classificationRepo.save(classification);
  }

  async updateClassification(
    id: string,
    data: Partial<DrugClassification>,
    tenantId?: string,
  ): Promise<DrugClassification> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);
    const classification = await this.classificationRepo.findOne({ where });
    if (!classification) throw new NotFoundException('Classification not found');
    Object.assign(classification, data);
    return this.classificationRepo.save(classification);
  }

  async getClassification(itemId: string, tenantId?: string): Promise<DrugClassification | null> {
    const where: any = { itemId };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.findOne({ where });
  }

  async getClassificationById(id: string, tenantId?: string): Promise<DrugClassification> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);
    const classification = await this.classificationRepo.findOne({ where });
    if (!classification) throw new NotFoundException('Classification not found');
    return classification;
  }

  async listClassifications(
    filters?: {
      schedule?: DrugSchedule;
      therapeuticClass?: TherapeuticClass;
      isControlled?: boolean;
      isNarcotic?: boolean;
      highAlert?: boolean;
      isOnFormulary?: boolean;
    },
    tenantId?: string,
  ): Promise<DrugClassification[]> {
    const qb = this.classificationRepo.createQueryBuilder('c');

    qb.andWhere('c.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });

    if (filters?.schedule) {
      qb.andWhere('c.schedule = :schedule', { schedule: filters.schedule });
    }
    if (filters?.therapeuticClass) {
      qb.andWhere('c.therapeuticClass = :therapeuticClass', {
        therapeuticClass: filters.therapeuticClass,
      });
    }
    if (filters?.isControlled !== undefined) {
      qb.andWhere('c.isControlled = :isControlled', { isControlled: filters.isControlled });
    }
    if (filters?.isNarcotic !== undefined) {
      qb.andWhere('c.isNarcotic = :isNarcotic', { isNarcotic: filters.isNarcotic });
    }
    if (filters?.highAlert !== undefined) {
      qb.andWhere('c.highAlert = :highAlert', { highAlert: filters.highAlert });
    }
    if (filters?.isOnFormulary !== undefined) {
      qb.andWhere('c.isOnFormulary = :isOnFormulary', { isOnFormulary: filters.isOnFormulary });
    }

    return qb.orderBy('c.genericName', 'ASC').getMany();
  }

  async getControlledSubstances(tenantId?: string): Promise<DrugClassification[]> {
    const where: any = { isControlled: true };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.find({
      where,
      order: { schedule: 'ASC', genericName: 'ASC' },
    });
  }

  async getNarcotics(tenantId?: string): Promise<DrugClassification[]> {
    const where: any = { isNarcotic: true };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.find({
      where,
      order: { genericName: 'ASC' },
    });
  }

  async getHighAlertMedications(tenantId?: string): Promise<DrugClassification[]> {
    const where: any = { highAlert: true };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.find({
      where,
      order: { genericName: 'ASC' },
    });
  }

  async getFormularyDrugs(tenantId?: string): Promise<DrugClassification[]> {
    const where: any = { isOnFormulary: true };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.find({
      where,
      order: { therapeuticClass: 'ASC', genericName: 'ASC' },
    });
  }

  async getDrugsByTherapeuticClass(
    therapeuticClass: TherapeuticClass,
    tenantId?: string,
  ): Promise<DrugClassification[]> {
    const where: any = { therapeuticClass };
    where.tenantId = requireTenantId(tenantId);
    return this.classificationRepo.find({
      where,
      order: { genericName: 'ASC' },
    });
  }

  async searchDrugs(query: string, tenantId?: string): Promise<DrugClassification[]> {
    const qb = this.classificationRepo
      .createQueryBuilder('c')
      .where('c.genericName ILIKE :query OR c.brandName ILIKE :query OR c.atcCode ILIKE :query', {
        query: `%${query}%`,
      });

    qb.andWhere('c.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });

    return qb.orderBy('c.genericName', 'ASC').take(50).getMany();
  }

  // ==================== DRUG INTERACTIONS ====================

  async createInteraction(
    data: Partial<DrugInteraction>,
    tenantId?: string,
  ): Promise<DrugInteraction> {
    // Check if interaction already exists (in either direction)
    const whereA: any = { drugAId: data.drugAId, drugBId: data.drugBId };
    const whereB: any = { drugAId: data.drugBId, drugBId: data.drugAId };
    const _tid = requireTenantId(tenantId);
    whereA.tenantId = _tid;
    whereB.tenantId = _tid;
    const existing = await this.interactionRepo.findOne({
      where: [whereA, whereB],
    });

    if (existing) {
      throw new BadRequestException('Drug interaction already exists');
    }

    data.tenantId = requireTenantId(tenantId);

    const interaction = this.interactionRepo.create(data);
    return this.interactionRepo.save(interaction);
  }

  async updateInteraction(
    id: string,
    data: Partial<DrugInteraction>,
    tenantId?: string,
  ): Promise<DrugInteraction> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);
    const interaction = await this.interactionRepo.findOne({ where });
    if (!interaction) throw new NotFoundException('Interaction not found');
    Object.assign(interaction, data);
    return this.interactionRepo.save(interaction);
  }

  async getInteractionsForDrug(drugId: string, tenantId?: string): Promise<DrugInteraction[]> {
    const whereA: any = { drugAId: drugId, isActive: true };
    const whereB: any = { drugBId: drugId, isActive: true };
    const _tid = requireTenantId(tenantId);
    whereA.tenantId = _tid;
    whereB.tenantId = _tid;
    return this.interactionRepo.find({
      where: [whereA, whereB],
      order: { severity: 'DESC' },
    });
  }

  async checkInteractions(
    drugIds: string[],
    tenantId?: string,
  ): Promise<{
    hasInteractions: boolean;
    interactions: Array<{
      drug1Id: string;
      drug2Id: string;
      severity: string;
      description: string;
      management?: string;
    }>;
  }> {
    const tid = requireTenantId(tenantId);
    if (drugIds.length < 2) {
      return { hasInteractions: false, interactions: [] };
    }

    const interactions: Array<{
      drug1Id: string;
      drug2Id: string;
      severity: string;
      description: string;
      management?: string;
    }> = [];

    // Check all pairs
    for (let i = 0; i < drugIds.length; i++) {
      for (let j = i + 1; j < drugIds.length; j++) {
        const whereA: any = { drugAId: drugIds[i], drugBId: drugIds[j], isActive: true };
        const whereB: any = { drugAId: drugIds[j], drugBId: drugIds[i], isActive: true };
        whereA.tenantId = tid;
        whereB.tenantId = tid;
        const interaction = await this.interactionRepo.findOne({
          where: [whereA, whereB],
        });

        if (interaction) {
          interactions.push({
            drug1Id: drugIds[i],
            drug2Id: drugIds[j],
            severity: interaction.severity,
            description: interaction.description,
            management: interaction.management || undefined,
          });
        }
      }
    }

    return {
      hasInteractions: interactions.length > 0,
      interactions,
    };
  }

  async getMajorInteractions(tenantId?: string): Promise<DrugInteraction[]> {
    const whereA: any = { severity: 'major', isActive: true };
    const whereB: any = { severity: 'contraindicated', isActive: true };
    const _tid = requireTenantId(tenantId);
    whereA.tenantId = _tid;
    whereB.tenantId = _tid;
    return this.interactionRepo.find({
      where: [whereA, whereB],
      order: { severity: 'DESC' },
    });
  }

  // ==================== ALLERGY CLASSES ====================

  async createAllergyClass(
    data: Partial<DrugAllergyClass>,
    tenantId?: string,
  ): Promise<DrugAllergyClass> {
    data.tenantId = requireTenantId(tenantId);
    const allergyClass = this.allergyClassRepo.create(data);
    return this.allergyClassRepo.save(allergyClass);
  }

  async listAllergyClasses(tenantId?: string): Promise<DrugAllergyClass[]> {
    const where: any = {};
    where.tenantId = requireTenantId(tenantId);
    return this.allergyClassRepo.find({ where, order: { className: 'ASC' } });
  }

  async checkAllergyRisk(
    drugId: string,
    patientAllergies: string[],
    tenantId?: string,
  ): Promise<{
    hasRisk: boolean;
    directMatch: boolean;
    crossReactiveRisk: boolean;
    matchedClasses: string[];
  }> {
    const tid = requireTenantId(tenantId);
    const classWhere: any = { itemId: drugId };
    classWhere.tenantId = tid;
    const classification = await this.classificationRepo.findOne({ where: classWhere });
    if (!classification) {
      return { hasRisk: false, directMatch: false, crossReactiveRisk: false, matchedClasses: [] };
    }

    const matchedClasses: string[] = [];
    let directMatch = false;
    let crossReactiveRisk = false;

    // Check if drug itself is in allergies
    if (
      patientAllergies.includes(drugId) ||
      patientAllergies.includes(classification.genericName || '') ||
      patientAllergies.includes(classification.brandName || '')
    ) {
      directMatch = true;
    }

    // Check allergy classes
    const allergyClassWhere: any = {};
    allergyClassWhere.tenantId = tid;
    const allergyClasses = await this.allergyClassRepo.find({ where: allergyClassWhere });
    for (const allergyClass of allergyClasses) {
      if (patientAllergies.includes(allergyClass.className)) {
        if (allergyClass.relatedDrugs?.includes(drugId)) {
          matchedClasses.push(allergyClass.className);
          crossReactiveRisk = true;
        }
      }

      // Check cross-reactive classes
      for (const patientAllergy of patientAllergies) {
        if (allergyClass.crossReactiveClasses?.includes(patientAllergy)) {
          if (allergyClass.relatedDrugs?.includes(drugId)) {
            matchedClasses.push(
              `${allergyClass.className} (cross-reactive with ${patientAllergy})`,
            );
            crossReactiveRisk = true;
          }
        }
      }
    }

    return {
      hasRisk: directMatch || crossReactiveRisk,
      directMatch,
      crossReactiveRisk,
      matchedClasses,
    };
  }

  // ==================== REPORTS ====================

  async getControlledSubstanceReport(tenantId?: string): Promise<{
    bySchedule: Record<string, number>;
    byTherapeuticClass: Record<string, number>;
    total: number;
  }> {
    const where: any = { isControlled: true };
    where.tenantId = requireTenantId(tenantId);
    const controlled = await this.classificationRepo.find({ where });

    const bySchedule: Record<string, number> = {};
    const byTherapeuticClass: Record<string, number> = {};

    for (const drug of controlled) {
      bySchedule[drug.schedule] = (bySchedule[drug.schedule] || 0) + 1;
      if (drug.therapeuticClass) {
        byTherapeuticClass[drug.therapeuticClass] =
          (byTherapeuticClass[drug.therapeuticClass] || 0) + 1;
      }
    }

    return {
      bySchedule,
      byTherapeuticClass,
      total: controlled.length,
    };
  }

  async getFormularyReport(tenantId?: string): Promise<{
    onFormulary: number;
    offFormulary: number;
    byTier: Record<string, number>;
    requiresPriorAuth: number;
    byTherapeuticClass: Record<string, { onFormulary: number; total: number }>;
  }> {
    const where: any = {};
    where.tenantId = requireTenantId(tenantId);
    const all = await this.classificationRepo.find({ where });

    let onFormulary = 0;
    let offFormulary = 0;
    let requiresPriorAuth = 0;
    const byTier: Record<string, number> = {};
    const byTherapeuticClass: Record<string, { onFormulary: number; total: number }> = {};

    for (const drug of all) {
      if (drug.isOnFormulary) {
        onFormulary++;
        if (drug.formularyTier) {
          byTier[drug.formularyTier] = (byTier[drug.formularyTier] || 0) + 1;
        }
      } else {
        offFormulary++;
      }

      if (drug.requiresPriorAuth) {
        requiresPriorAuth++;
      }

      if (drug.therapeuticClass) {
        if (!byTherapeuticClass[drug.therapeuticClass]) {
          byTherapeuticClass[drug.therapeuticClass] = { onFormulary: 0, total: 0 };
        }
        byTherapeuticClass[drug.therapeuticClass].total++;
        if (drug.isOnFormulary) {
          byTherapeuticClass[drug.therapeuticClass].onFormulary++;
        }
      }
    }

    return {
      onFormulary,
      offFormulary,
      byTier,
      requiresPriorAuth,
      byTherapeuticClass,
    };
  }
}
