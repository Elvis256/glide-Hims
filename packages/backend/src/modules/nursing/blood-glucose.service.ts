import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BloodGlucoseReading } from '../../database/entities/blood-glucose-reading.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateBloodGlucoseDto, QueryBloodGlucoseDto } from './dto/blood-glucose.dto';

@Injectable()
export class BloodGlucoseService {
  private readonly logger = new Logger(BloodGlucoseService.name);

  constructor(
    @InjectRepository(BloodGlucoseReading)
    private readonly repo: Repository<BloodGlucoseReading>,
  ) {}

  async create(dto: CreateBloodGlucoseDto, userId: string, tenantId?: string): Promise<BloodGlucoseReading> {
    const tid = requireTenantId(tenantId);
    const reading = this.repo.create({
      ...dto,
      tenantId: tid,
      recordedById: userId,
    });
    return this.repo.save(reading);
  }

  async list(query: QueryBloodGlucoseDto, tenantId?: string): Promise<BloodGlucoseReading[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('bg')
      .leftJoinAndSelect('bg.recordedBy', 'recordedBy')
      .where('bg.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) {
      qb.andWhere('bg.admission_id = :admissionId', { admissionId: query.admissionId });
    }

    return qb.orderBy('bg.created_at', 'DESC').getMany();
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.repo.softDelete({ id, tenantId: tid });
  }
}
