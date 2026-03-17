import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { PrescriptionTemplate, RxTemplateItem } from '../../database/entities/rx-template.entity';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  condition?: string;
  department?: string;
  scope: 'personal' | 'department' | 'facility';
  items: RxTemplateItem[];
  facilityId?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  condition?: string;
  department?: string;
  scope?: 'personal' | 'department' | 'facility';
  items?: RxTemplateItem[];
  isActive?: boolean;
}

@Injectable()
export class RxTemplateService {
  constructor(
    @InjectRepository(PrescriptionTemplate)
    private readonly templateRepo: Repository<PrescriptionTemplate>,
  ) {}

  async createTemplate(
    data: CreateTemplateDto,
    userId: string,
    tenantId: string,
  ): Promise<PrescriptionTemplate> {
    const template = this.templateRepo.create({
      ...data,
      createdById: userId,
      tenantId,
    });
    return this.templateRepo.save(template);
  }

  async getTemplates(
    tenantId: string,
    facilityId?: string,
    userId?: string,
    department?: string,
    condition?: string,
    scope?: string,
  ): Promise<PrescriptionTemplate[]> {
    const qb = this.templateRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.is_active = :active', { active: true });

    // Visibility: personal templates only for the owner, department for same dept, facility for all
    if (userId) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("t.scope = 'facility'")
            .orWhere("t.scope = 'department'")
            .orWhere("(t.scope = 'personal' AND t.created_by_id = :userId)", { userId });
        }),
      );
    }

    if (facilityId) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('t.facility_id = :facilityId', { facilityId })
            .orWhere('t.facility_id IS NULL');
        }),
      );
    }

    if (department) {
      qb.andWhere('t.department = :department', { department });
    }

    if (condition) {
      qb.andWhere('LOWER(t.condition) LIKE LOWER(:condition)', {
        condition: `%${condition}%`,
      });
    }

    if (scope) {
      qb.andWhere('t.scope = :scope', { scope });
    }

    qb.orderBy('t.usage_count', 'DESC').addOrderBy('t.name', 'ASC');

    return qb.getMany();
  }

  async getTemplate(id: string, tenantId: string): Promise<PrescriptionTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async updateTemplate(
    id: string,
    data: UpdateTemplateDto,
    userId: string,
    tenantId: string,
  ): Promise<PrescriptionTemplate> {
    const template = await this.getTemplate(id, tenantId);

    if (template.createdById !== userId) {
      throw new ForbiddenException('Only the template owner can update this template');
    }

    Object.assign(template, data);
    return this.templateRepo.save(template);
  }

  async deleteTemplate(
    id: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const template = await this.getTemplate(id, tenantId);

    if (template.createdById !== userId) {
      throw new ForbiddenException('Only the template owner can delete this template');
    }

    await this.templateRepo.softDelete(id);
  }

  async applyTemplate(
    templateId: string,
    tenantId: string,
  ): Promise<{ items: RxTemplateItem[] }> {
    const template = await this.getTemplate(templateId, tenantId);

    await this.templateRepo.increment({ id: templateId }, 'usageCount', 1);

    return { items: template.items };
  }

  async getPopularTemplates(
    tenantId: string,
    facilityId?: string,
    limit = 10,
  ): Promise<PrescriptionTemplate[]> {
    const qb = this.templateRepo
      .createQueryBuilder('t')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.is_active = :active', { active: true })
      .andWhere('t.usage_count > 0');

    if (facilityId) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('t.facility_id = :facilityId', { facilityId })
            .orWhere('t.facility_id IS NULL');
        }),
      );
    }

    qb.orderBy('t.usage_count', 'DESC').limit(limit);

    return qb.getMany();
  }
}
