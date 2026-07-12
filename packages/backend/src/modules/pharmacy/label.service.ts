import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DrugLabelTemplate,
  CommonDrugTranslation,
  LabelType,
} from '../../database/entities/drug-label-template.entity';
import { PrescriptionItem, Prescription } from '../../database/entities/prescription.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

// Default Luganda translations for common directions
const DEFAULT_LUGANDA_DIRECTIONS: Record<string, string> = {
  'Take X tablet(s) Y times daily': 'Mira ekyapa X emirundi Y buli lunaku',
  'Before meals': 'Nga tonnalya',
  'After meals': "Ng'omaze okulya",
  'At bedtime': "Ng'ogenda okwebaka",
  'Keep out of reach of children': 'Kuma abaana baleme okukituuka',
  'Take with water': "Mira n'amazzi",
  'Do not crush or chew': 'Tosiimuula oba okukagga',
  'Shake well before use': 'Nyiga bulungi nga tonnakozesa',
};

@Injectable()
export class LabelService {
  constructor(
    @InjectRepository(DrugLabelTemplate)
    private templateRepo: Repository<DrugLabelTemplate>,
    @InjectRepository(CommonDrugTranslation)
    private translationRepo: Repository<CommonDrugTranslation>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepo: Repository<PrescriptionItem>,
  ) {}

  async generateLabel(prescriptionItemId: string, language: string = 'en', tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const item = await this.prescriptionItemRepo.findOne({
      where: { id: prescriptionItemId, tenantId: tid },
      relations: ['prescription'],
    });

    if (!item) {
      throw new NotFoundException('Prescription item not found');
    }

    // Find matching template
    const template = await this.templateRepo.findOne({
      where: {
        language,
        isDefault: true,
        tenantId: tid,
      },
    });

    // Find drug translation if not English
    let translation: CommonDrugTranslation | null = null;
    if (language !== 'en') {
      translation = await this.translationRepo.findOne({
        where: {
          drugName: item.drugName,
          language,
          tenantId: tid,
        },
      });
    }

    // Build the label
    const labelData = {
      drugName: item.drugName,
      translatedDrugName: translation?.translatedName || item.drugName,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      instructions: item.instructions,
      translatedDirections:
        translation?.directions || this.getDefaultTranslation(item.instructions, language),
      translatedWarnings: translation?.warnings || '',
      prescriptionNumber: item.prescription?.prescriptionNumber || '',
      date: new Date().toISOString().split('T')[0],
      language,
    };

    // Fill template if available
    if (template) {
      return {
        header: this.fillTemplate(template.headerTemplate, labelData),
        body: this.fillTemplate(template.bodyTemplate, labelData),
        footer: this.fillTemplate(template.footerTemplate, labelData),
        raw: labelData,
        templateId: template.id,
      };
    }

    // Return raw label data with a default layout
    return {
      header: `${labelData.drugName}${labelData.translatedDrugName !== labelData.drugName ? ` / ${labelData.translatedDrugName}` : ''}`,
      body: [
        `Dose: ${labelData.dose} | Frequency: ${labelData.frequency} | Duration: ${labelData.duration}`,
        `Qty: ${labelData.quantity}`,
        labelData.instructions ? `Instructions: ${labelData.instructions}` : '',
        labelData.translatedDirections ? `(${labelData.translatedDirections})` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      footer: [
        labelData.translatedWarnings || '',
        `Rx#: ${labelData.prescriptionNumber}`,
        `Date: ${labelData.date}`,
      ]
        .filter(Boolean)
        .join('\n'),
      raw: labelData,
      templateId: null,
    };
  }

  async getTemplates(tenantId?: string, language?: string) {
    const tid = requireTenantId(tenantId);
    const where: any = {};
    where.tenantId = tid;
    if (language) where.language = language;
    return this.templateRepo.find({ where, order: { language: 'ASC', isDefault: 'DESC' } });
  }

  async createTemplate(
    data: Partial<DrugLabelTemplate>,
    tenantId?: string,
  ): Promise<DrugLabelTemplate> {
    const tid = requireTenantId(tenantId);
    const template = this.templateRepo.create({
      ...data,
      tenantId: tid,
    });
    return this.templateRepo.save(template);
  }

  async getTranslation(drugName: string, language: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    return this.translationRepo.findOne({
      where: {
        drugName,
        language,
        tenantId: tid,
      },
    });
  }

  async getTranslations(tenantId?: string, language?: string) {
    const tid = requireTenantId(tenantId);
    const where: any = {};
    where.tenantId = tid;
    if (language) where.language = language;
    return this.translationRepo.find({ where, order: { drugName: 'ASC' } });
  }

  async createTranslation(
    data: Partial<CommonDrugTranslation>,
    tenantId?: string,
  ): Promise<CommonDrugTranslation> {
    const tid = requireTenantId(tenantId);
    const translation = this.translationRepo.create({
      ...data,
      tenantId: tid,
    });
    return this.translationRepo.save(translation);
  }

  /** Get a default Luganda translation for common directions */
  getDefaultLugandaDirections(): Record<string, string> {
    return { ...DEFAULT_LUGANDA_DIRECTIONS };
  }

  private getDefaultTranslation(instructions: string | null, language: string): string {
    if (!instructions || language !== 'lg') return '';
    // Check if any default direction matches
    for (const [en, lg] of Object.entries(DEFAULT_LUGANDA_DIRECTIONS)) {
      if (instructions.toLowerCase().includes(en.toLowerCase())) {
        return lg;
      }
    }
    return '';
  }

  private fillTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
    });
  }
}
