import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WoundAssessment } from '../../database/entities/wound-assessment.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateWoundAssessmentDto, QueryWoundAssessmentDto } from './dto/wound-assessment.dto';

@Injectable()
export class WoundAssessmentService {
  private readonly logger = new Logger(WoundAssessmentService.name);

  constructor(
    @InjectRepository(WoundAssessment)
    private readonly repo: Repository<WoundAssessment>,
  ) {}

  async create(dto: CreateWoundAssessmentDto, userId: string, tenantId?: string): Promise<WoundAssessment> {
    const tid = requireTenantId(tenantId);
    const wound = this.repo.create({
      ...dto,
      tenantId: tid,
      assessedById: userId,
    });
    return this.repo.save(wound);
  }

  async list(query: QueryWoundAssessmentDto, tenantId?: string): Promise<WoundAssessment[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('w')
      .leftJoinAndSelect('w.assessedBy', 'assessedBy')
      .where('w.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) {
      qb.andWhere('w.admission_id = :admissionId', { admissionId: query.admissionId });
    }

    return qb.orderBy('w.created_at', 'DESC').getMany();
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.repo.softDelete({ id, tenantId: tid });
  }
}
