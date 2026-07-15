import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IncidentReport } from '../../database/entities/incident-report.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateIncidentReportDto, UpdateIncidentReportDto, QueryIncidentReportDto } from './dto/incident-report.dto';

@Injectable()
export class IncidentReportService {
  private readonly logger = new Logger(IncidentReportService.name);

  constructor(
    @InjectRepository(IncidentReport)
    private readonly repo: Repository<IncidentReport>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateIncidentReportDto, userId: string, tenantId?: string): Promise<IncidentReport> {
    const tid = requireTenantId(tenantId);

    return this.dataSource.transaction(async (manager) => {
      // Advisory lock for tenant-scoped numbering
      const lockKey = Buffer.from(`incident_${tid}`).reduce((a, b) => a + b, 0) & 0x7fffffff;
      await manager.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey]);

      const maxResult = await manager.query(
        `SELECT COALESCE(MAX(CAST(REPLACE(report_number, 'INC-', '') AS int)), 0) AS max_num
         FROM incident_reports WHERE tenant_id = $1`,
        [tid],
      );
      const nextNum = (maxResult[0]?.max_num || 0) + 1;
      const reportNumber = `INC-${String(nextNum).padStart(5, '0')}`;

      const report = manager.create(IncidentReport, {
        ...dto,
        reportNumber,
        tenantId: tid,
        reportedById: userId,
        status: dto.status || 'draft',
      });
      return manager.save(report);
    });
  }

  async list(query: QueryIncidentReportDto, tenantId?: string): Promise<IncidentReport[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('inc')
      .leftJoinAndSelect('inc.patient', 'patient')
      .leftJoinAndSelect('inc.reportedBy', 'reportedBy')
      .where('inc.tenant_id = :tenantId', { tenantId: tid });

    if (query.status) qb.andWhere('inc.status = :status', { status: query.status });
    if (query.type) qb.andWhere('inc.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('inc.severity = :severity', { severity: query.severity });

    return qb.orderBy('inc.created_at', 'DESC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<IncidentReport> {
    const tid = requireTenantId(tenantId);
    const report = await this.repo.findOne({
      where: { id, tenantId: tid },
      relations: ['patient', 'reportedBy'],
    });
    if (!report) throw new NotFoundException('Incident report not found');
    return report;
  }

  async update(id: string, dto: UpdateIncidentReportDto, tenantId?: string): Promise<IncidentReport> {
    const report = await this.findOne(id, tenantId);
    Object.assign(report, dto);
    return this.repo.save(report);
  }

  async getStats(tenantId?: string): Promise<{ byType: Record<string, number>; bySeverity: Record<string, number>; total: number }> {
    const tid = requireTenantId(tenantId);

    const byType = await this.repo.createQueryBuilder('inc')
      .select('inc.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('inc.tenant_id = :tenantId', { tenantId: tid })
      .groupBy('inc.type')
      .getRawMany();

    const bySeverity = await this.repo.createQueryBuilder('inc')
      .select('inc.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('inc.tenant_id = :tenantId', { tenantId: tid })
      .groupBy('inc.severity')
      .getRawMany();

    const total = byType.reduce((sum, r) => sum + Number(r.count), 0);

    return {
      byType: Object.fromEntries(byType.map(r => [r.type, Number(r.count)])),
      bySeverity: Object.fromEntries(bySeverity.map(r => [r.severity, Number(r.count)])),
      total,
    };
  }
}
