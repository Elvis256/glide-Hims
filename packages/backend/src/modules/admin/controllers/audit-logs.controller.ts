import { Controller, Get, Query, Request, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { AuditLog } from '../../../database/entities/audit-log.entity';

@ApiTags('Admin - Audit Logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  private baseQuery(req: any) {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.fullName', 'u.email']);
    if (req?.user?.tenantId) qb.andWhere('a.tenantId = :tid', { tid: req.user.tenantId });
    return qb;
  }

  private applyFilters(
    qb: ReturnType<AuditLogsController['baseQuery']>,
    opts: {
      userId?: string;
      action?: string;
      entityType?: string;
      from?: string;
      to?: string;
      q?: string;
      excludeReads?: string;
      onlyErrors?: string;
      minStatus?: string;
      maxStatus?: string;
    },
  ) {
    if (opts.userId) qb.andWhere('a.userId = :uid', { uid: opts.userId });
    if (opts.action) qb.andWhere('a.action ILIKE :act', { act: `%${opts.action}%` });
    if (opts.entityType) qb.andWhere('a.entityType ILIKE :et', { et: `%${opts.entityType}%` });
    if (opts.from) qb.andWhere('a.createdAt >= :from', { from: new Date(opts.from) });
    if (opts.to) qb.andWhere('a.createdAt <= :to', { to: new Date(opts.to) });
    if (opts.q) {
      qb.andWhere(
        '(a.requestUrl ILIKE :q OR a.entityId::text ILIKE :q OR a.ipAddress ILIKE :q OR a.reason ILIKE :q OR a.attemptedIdentifier ILIKE :q OR u.username ILIKE :q OR u.fullName ILIKE :q OR u.email ILIKE :q)',
        { q: `%${opts.q}%` },
      );
    }
    if (opts.excludeReads === 'true' || opts.excludeReads === '1') {
      qb.andWhere("a.action NOT IN ('READ','TOKEN_REFRESHED')");
    }
    if (opts.onlyErrors === 'true' || opts.onlyErrors === '1') {
      qb.andWhere('(a.statusCode >= 400 OR a.action ILIKE :failsuffix)', {
        failsuffix: '%FAILED%',
      });
    }
    if (opts.minStatus) qb.andWhere('a.statusCode >= :minS', { minS: Number(opts.minStatus) });
    if (opts.maxStatus) qb.andWhere('a.statusCode <= :maxS', { maxS: Number(opts.maxStatus) });
    return qb;
  }

  @Get()
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'List audit log entries with filters' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
  @ApiQuery({ name: 'excludeReads', required: false })
  @ApiQuery({ name: 'onlyErrors', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async list(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('excludeReads') excludeReads?: string,
    @Query('onlyErrors') onlyErrors?: string,
    @Query('minStatus') minStatus?: string,
    @Query('maxStatus') maxStatus?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    const qb = this.applyFilters(this.baseQuery(req), {
      userId,
      action,
      entityType,
      from,
      to,
      q,
      excludeReads,
      onlyErrors,
      minStatus,
      maxStatus,
    });
    const take = Math.min(Number(limit) || 100, 1000);
    const skip = Number(offset) || 0;
    const [data, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .take(take)
      .skip(skip)
      .getManyAndCount();
    return {
      data,
      meta: { total, limit: take, offset: skip },
    };
  }

  @Get('stats')
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Facets/aggregates for audit log filters & summary' })
  async stats(@Request() req: any) {
    const tenantId = req?.user?.tenantId;
    const baseWhere = tenantId ? 'WHERE tenant_id = $1' : '';
    const params: any[] = tenantId ? [tenantId] : [];
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [totals, actions, entities, recent24h, topUsers, errorCount] = await Promise.all([
      this.repo.query(`SELECT count(*)::int AS total FROM audit_logs ${baseWhere}`, params),
      this.repo.query(
        `SELECT action, count(*)::int AS count FROM audit_logs ${baseWhere} GROUP BY action ORDER BY count DESC LIMIT 50`,
        params,
      ),
      this.repo.query(
        `SELECT entity_type AS "entityType", count(*)::int AS count FROM audit_logs ${baseWhere} GROUP BY entity_type ORDER BY count DESC LIMIT 50`,
        params,
      ),
      this.repo.query(
        `SELECT count(*)::int AS count FROM audit_logs ${baseWhere}${baseWhere ? ' AND' : ' WHERE'} created_at >= $${params.length + 1}`,
        [...params, since24h],
      ),
      this.repo.query(
        `SELECT a.user_id AS "userId", u.username, u.full_name AS "fullName", count(*)::int AS count
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         ${baseWhere ? baseWhere.replace('tenant_id', 'a.tenant_id') : ''}
         ${baseWhere ? 'AND' : 'WHERE'} a.user_id IS NOT NULL
         GROUP BY a.user_id, u.username, u.full_name
         ORDER BY count DESC LIMIT 10`,
        params,
      ),
      this.repo.query(
        `SELECT count(*)::int AS count FROM audit_logs ${baseWhere}${baseWhere ? ' AND' : ' WHERE'} (status_code >= 400 OR action ILIKE '%FAILED%')`,
        params,
      ),
    ]);

    return {
      total: totals[0]?.total || 0,
      recent24h: recent24h[0]?.count || 0,
      errorCount: errorCount[0]?.count || 0,
      actions,
      entityTypes: entities,
      topUsers,
    };
  }

  @Get('export')
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  async export(
    @Query('userId') userId: string,
    @Query('action') action: string,
    @Query('entityType') entityType: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('q') q: string,
    @Query('excludeReads') excludeReads: string,
    @Query('onlyErrors') onlyErrors: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const qb = this.applyFilters(this.baseQuery(req), {
      userId,
      action,
      entityType,
      from,
      to,
      q,
      excludeReads,
      onlyErrors,
    });
    // Fix 13: paginated streaming instead of loading 50K rows at once
    const PAGE_SIZE = 5000;
    const cols = [
      'id',
      'createdAt',
      'actorType',
      'userId',
      'username',
      'fullName',
      'action',
      'entityType',
      'entityId',
      'requestMethod',
      'requestUrl',
      'statusCode',
      'reason',
      'ipAddress',
      'userAgent',
    ];
    // Fix 13: sanitize CSV values to prevent formula injection
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      // Prefix formula-triggering characters with a single quote
      if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
      }
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.write(cols.join(',') + '\n');

    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const rows = await qb.orderBy('a.createdAt', 'DESC').skip(offset).take(PAGE_SIZE).getMany();
      for (const r of rows as any[]) {
        const flat = {
          ...r,
          username: r.user?.username,
          fullName: r.user?.fullName,
        };
        res.write(cols.map((c) => escape(flat[c])).join(',') + '\n');
      }
      offset += rows.length;
      hasMore = rows.length === PAGE_SIZE && offset < 50000;
    }
    res.end();
  }
}
