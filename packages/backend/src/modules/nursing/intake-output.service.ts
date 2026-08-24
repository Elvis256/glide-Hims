import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntakeOutputEntry } from '../../database/entities/intake-output-entry.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { dayBoundsUtc } from '../../common/utils/timezone.util';
import { CreateIntakeOutputDto, QueryIntakeOutputDto } from './dto/intake-output.dto';

@Injectable()
export class IntakeOutputService {
  private readonly logger = new Logger(IntakeOutputService.name);

  constructor(
    @InjectRepository(IntakeOutputEntry)
    private readonly repo: Repository<IntakeOutputEntry>,
  ) {}

  async create(dto: CreateIntakeOutputDto, userId: string, tenantId?: string): Promise<IntakeOutputEntry> {
    const tid = requireTenantId(tenantId);
    const entry = this.repo.create({
      ...dto,
      tenantId: tid,
      recordedById: userId,
    });
    return this.repo.save(entry);
  }

  async list(query: QueryIntakeOutputDto, tenantId?: string): Promise<IntakeOutputEntry[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('io')
      .leftJoinAndSelect('io.recordedBy', 'recordedBy')
      .where('io.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) {
      qb.andWhere('io.admission_id = :admissionId', { admissionId: query.admissionId });
    }
    if (query.dateFrom) {
      qb.andWhere('io.timestamp >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('io.timestamp <= :dateTo', { dateTo: query.dateTo });
    }

    return qb.orderBy('io.timestamp', 'DESC').getMany();
  }

  async getDailySummary(admissionId: string, tenantId?: string): Promise<{ intake: number; output: number; balance: number }> {
    const tid = requireTenantId(tenantId);
    // The ward's day, not the server's. setHours runs in the server zone (UTC),
    // so the fluid balance day began at 03:00 local: everything charted on the
    // night shift before then counted against the day before, and for the first
    // three hours of every morning the running balance was missing it.
    const { start: today } = dayBoundsUtc(new Date());

    const result = await this.repo
      .createQueryBuilder('io')
      .select('io.type', 'type')
      .addSelect('COALESCE(SUM(io.amount), 0)', 'total')
      .where('io.tenant_id = :tenantId', { tenantId: tid })
      .andWhere('io.admission_id = :admissionId', { admissionId })
      .andWhere('io.timestamp >= :today', { today })
      .groupBy('io.type')
      .getRawMany();

    const intake = Number(result.find(r => r.type === 'intake')?.total || 0);
    const output = Number(result.find(r => r.type === 'output')?.total || 0);
    return { intake, output, balance: intake - output };
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.repo.softDelete({ id, tenantId: tid });
  }
}
