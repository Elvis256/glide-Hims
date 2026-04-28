import { Controller, Get, Query, Request, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, ILike } from 'typeorm';
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

  private buildWhere(opts: {
    tenantId?: string;
    userId?: string;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {};
    if (opts.tenantId) where.tenantId = opts.tenantId;
    if (opts.userId) where.userId = opts.userId;
    if (opts.action) where.action = ILike(`%${opts.action}%`);
    if (opts.entityType) where.entityType = ILike(`%${opts.entityType}%`);
    if (opts.from && opts.to) {
      where.createdAt = Between(new Date(opts.from), new Date(opts.to));
    } else if (opts.from) {
      where.createdAt = MoreThanOrEqual(new Date(opts.from));
    } else if (opts.to) {
      where.createdAt = LessThanOrEqual(new Date(opts.to));
    }
    return where;
  }

  @Get()
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'List audit log entries with filters' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async list(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    const where = this.buildWhere({
      tenantId: req?.user?.tenantId,
      userId,
      action,
      entityType,
      from,
      to,
    });
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Number(limit) || 100, 1000),
      skip: Number(offset) || 0,
    });
    return {
      data,
      meta: { total, limit: Number(limit) || 100, offset: Number(offset) || 0 },
    };
  }

  @Get('export')
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async export(
    @Query('userId') userId: string,
    @Query('action') action: string,
    @Query('entityType') entityType: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const where = this.buildWhere({
      tenantId: req?.user?.tenantId,
      userId,
      action,
      entityType,
      from,
      to,
    });
    const rows = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50000,
    });
    const cols = [
      'id',
      'createdAt',
      'actorType',
      'userId',
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
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(',')];
    for (const r of rows as any[]) {
      lines.push(cols.map((c) => escape(r[c])).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }
}
