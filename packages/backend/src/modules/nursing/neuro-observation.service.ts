import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NeuroObservation } from '../../database/entities/neuro-observation.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateNeuroObservationDto, QueryNeuroObservationDto } from './dto/neuro-observation.dto';

@Injectable()
export class NeuroObservationService {
  private readonly logger = new Logger(NeuroObservationService.name);

  constructor(
    @InjectRepository(NeuroObservation)
    private readonly repo: Repository<NeuroObservation>,
  ) {}

  async create(dto: CreateNeuroObservationDto, userId: string, tenantId?: string): Promise<NeuroObservation> {
    const tid = requireTenantId(tenantId);
    const gcsTotal = (dto.gcsEye || 0) + (dto.gcsVerbal || 0) + (dto.gcsMotor || 0);
    const obs = this.repo.create({
      ...dto,
      gcsTotal: (dto.gcsEye && dto.gcsVerbal && dto.gcsMotor) ? gcsTotal : undefined,
      tenantId: tid,
      assessedById: userId,
    });
    return this.repo.save(obs);
  }

  async list(query: QueryNeuroObservationDto, tenantId?: string): Promise<NeuroObservation[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('neuro')
      .leftJoinAndSelect('neuro.assessedBy', 'assessedBy')
      .where('neuro.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) {
      qb.andWhere('neuro.admission_id = :admissionId', { admissionId: query.admissionId });
    }

    return qb.orderBy('neuro.created_at', 'DESC').getMany();
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.repo.softDelete({ id, tenantId: tid });
  }
}
