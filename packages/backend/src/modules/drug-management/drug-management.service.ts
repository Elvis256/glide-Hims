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

  async createClassification(data: Partial<DrugClassification>): Promise<DrugClassification> {
    // Set derived flags
    if (data.schedule === DrugSchedule.SCHEDULE_I || data.schedule === DrugSchedule.SCHEDULE_II) {
      data.isControlled = true;
      data.requiresDoubleCheck = true;
    }
    
    const classification = this.classificationRepo.create(data);
    return this.classificationRepo.save(classification);
  }

  async updateClassification(id: string, data: Partial<DrugClassification>): Promise<DrugClassification> {
    const classification = await this.classificationRepo.findOne({ where: { id } });
    if (!classification) throw new NotFoundException('Classification not found');
    Object.assign(classification, data);
    return this.classificationRepo.save(classification);
  }

  async getClassification(itemId: string): Promise<DrugClassification | null> {
    return this.classificationRepo.findOne({ where: { itemId } });
  }

  async getClassificationById(id: string): Promise<DrugClassification> {
    const classification = await this.classificationRepo.findOne({ where: { id } });
    if (!classification) throw new NotFoundException('Classification not found');
    return classification;
  }

  async listClassifications(filters?: {
    schedule?: DrugSchedule;
    therapeuticClass?: TherapeuticClass;
    isControlled?: boolean;
    isNarcotic?: boolean;
    highAlert?: boolean;
    isOnFormulary?: boolean;
  }): Promise<DrugClassification[]> {
    const qb = this.classificationRepo.createQueryBuilder('c');

    if (filters?.schedule) {
      qb.andWhere('c.schedule = :schedule', { schedule: filters.schedule });
    }
    if (filters?.therapeuticClass) {
      qb.andWhere('c.therapeuticClass = :therapeuticClass', { therapeuticClass: filters.therapeuticClass });
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

  async getControlledSubstances(): Promise<DrugClassification[]> {
    return this.classificationRepo.find({
      where: { isControlled: true },
      order: { schedule: 'ASC', genericName: 'ASC' },
    });
  }

  async getNarcotics(): Promise<DrugClassification[]> {
    return this.classificationRepo.find({
      where: { isNarcotic: true },
      order: { genericName: 'ASC' },
    });
  }

  async getHighAlertMedications(): Promise<DrugClassification[]> {
    return this.classificationRepo.find({
      where: { highAlert: true },
      order: { genericName: 'ASC' },
    });
  }

  async getFormularyDrugs(): Promise<DrugClassification[]> {
    return this.classificationRepo.find({
      where: { isOnFormulary: true },
      order: { therapeuticClass: 'ASC', genericName: 'ASC' },
    });
  }

  async getDrugsByTherapeuticClass(therapeuticClass: TherapeuticClass): Promise<DrugClassification[]> {
    return this.classificationRepo.find({
      where: { therapeuticClass },
      order: { genericName: 'ASC' },
    });
  }

  async searchDrugs(query: string): Promise<DrugClassification[]> {
    return this.classificationRepo.createQueryBuilder('c')
      .where('c.genericName ILIKE :query OR c.brandName ILIKE :query OR c.atcCode ILIKE :query', 
        { query: `%${query}%` })
      .orderBy('c.genericName', 'ASC')
      .take(50)
      .getMany();
  }

  // ==================== DRUG INTERACTIONS ====================

  async createInteraction(data: Partial<DrugInteraction>): Promise<DrugInteraction> {
    // Check if interaction already exists (in either direction)
    const existing = await this.interactionRepo.findOne({
      where: [
        { drugAId: data.drugAId, drugBId: data.drugBId },
        { drugAId: data.drugBId, drugBId: data.drugAId },
      ],
    });
    
    if (existing) {
      throw new BadRequestException('Drug interaction already exists');
    }

    const interaction = this.interactionRepo.create(data);
    return this.interactionRepo.save(interaction);
  }

  async updateInteraction(id: string, data: Partial<DrugInteraction>): Promise<DrugInteraction> {
    const interaction = await this.interactionRepo.findOne({ where: { id } });
    if (!interaction) throw new NotFoundException('Interaction not found');
    Object.assign(interaction, data);
    return this.interactionRepo.save(interaction);
  }

  async getInteractionsForDrug(drugId: string): Promise<DrugInteraction[]> {
    return this.interactionRepo.find({
      where: [
        { drugAId: drugId, isActive: true },
        { drugBId: drugId, isActive: true },
      ],
      order: { severity: 'DESC' },
    });
  }

  async checkInteractions(drugIds: string[]): Promise<{
    hasInteractions: boolean;
    interactions: Array<{
      drug1Id: string;
      drug2Id: string;
      severity: string;
      description: string;
      management?: string;
    }>;
  }> {
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
        const interaction = await this.interactionRepo.findOne({
          where: [
            { drugAId: drugIds[i], drugBId: drugIds[j], isActive: true },
            { drugAId: drugIds[j], drugBId: drugIds[i], isActive: true },
          ],
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

  async getMajorInteractions(): Promise<DrugInteraction[]> {
    return this.interactionRepo.find({
      where: [
        { severity: 'major', isActive: true },
        { severity: 'contraindicated', isActive: true },
      ],
      order: { severity: 'DESC' },
    });
  }

  // ==================== ALLERGY CLASSES ====================

  async createAllergyClass(data: Partial<DrugAllergyClass>): Promise<DrugAllergyClass> {
    const allergyClass = this.allergyClassRepo.create(data);
    return this.allergyClassRepo.save(allergyClass);
  }

  async listAllergyClasses(): Promise<DrugAllergyClass[]> {
    return this.allergyClassRepo.find({ order: { className: 'ASC' } });
  }

  async checkAllergyRisk(drugId: string, patientAllergies: string[]): Promise<{
    hasRisk: boolean;
    directMatch: boolean;
    crossReactiveRisk: boolean;
    matchedClasses: string[];
  }> {
    const classification = await this.classificationRepo.findOne({ where: { itemId: drugId } });
    if (!classification) {
      return { hasRisk: false, directMatch: false, crossReactiveRisk: false, matchedClasses: [] };
    }

    const matchedClasses: string[] = [];
    let directMatch = false;
    let crossReactiveRisk = false;

    // Check if drug itself is in allergies
    if (patientAllergies.includes(drugId) || 
        patientAllergies.includes(classification.genericName || '') ||
        patientAllergies.includes(classification.brandName || '')) {
      directMatch = true;
    }

    // Check allergy classes
    const allergyClasses = await this.allergyClassRepo.find();
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
            matchedClasses.push(`${allergyClass.className} (cross-reactive with ${patientAllergy})`);
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

  async getControlledSubstanceReport(): Promise<{
    bySchedule: Record<string, number>;
    byTherapeuticClass: Record<string, number>;
    total: number;
  }> {
    const controlled = await this.classificationRepo.find({ where: { isControlled: true } });

    const bySchedule: Record<string, number> = {};
    const byTherapeuticClass: Record<string, number> = {};

    for (const drug of controlled) {
      bySchedule[drug.schedule] = (bySchedule[drug.schedule] || 0) + 1;
      if (drug.therapeuticClass) {
        byTherapeuticClass[drug.therapeuticClass] = (byTherapeuticClass[drug.therapeuticClass] || 0) + 1;
      }
    }

    return {
      bySchedule,
      byTherapeuticClass,
      total: controlled.length,
    };
  }

  async getFormularyReport(): Promise<{
    onFormulary: number;
    offFormulary: number;
    byTier: Record<string, number>;
    requiresPriorAuth: number;
    byTherapeuticClass: Record<string, { onFormulary: number; total: number }>;
  }> {
    const all = await this.classificationRepo.find();

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
