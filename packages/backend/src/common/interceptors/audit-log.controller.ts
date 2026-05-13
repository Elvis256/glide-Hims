import { Controller, Get, Query, Headers, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthWithPermissions } from '../../modules/auth/decorators/auth.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Get audit logs with filters' })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Headers('x-facility-id') facilityId?: string,
    @Request() req?: any,
  ) {
    const isSystemAdmin = !!req?.user?.isSystemAdmin;
    return this.auditLogService.findAllPaginated({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      search,
      tenantId: isSystemAdmin ? undefined : req?.user?.tenantId,
    });
  }

  @Get('stats')
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Get audit log statistics' })
  async getStats(@Request() req?: any) {
    const isSystemAdmin = !!req?.user?.isSystemAdmin;
    return this.auditLogService.getStats(isSystemAdmin ? undefined : req?.user?.tenantId);
  }

  @Get('export.csv')
  @AuthWithPermissions('audit.read')
  @ApiOperation({ summary: 'Export filtered audit logs as CSV (max 5000 rows)' })
  async exportCsv(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Request() req?: any,
  ) {
    const isSystemAdmin = !!req?.user?.isSystemAdmin;
    const result = await this.auditLogService.findAllPaginated({
      page: 1,
      limit: 5000,
      userId, action, entityType, entityId, startDate, endDate, search,
      tenantId: isSystemAdmin ? undefined : req?.user?.tenantId,
    });
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['createdAt','actorType','user','action','entityType','entityId','requestMethod','requestUrl','statusCode','ipAddress','reason','oldValue','newValue'];
    const lines = [header.join(',')];
    for (const r of result.data as any[]) {
      const u = r.user;
      const userLabel = u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email || u.id || '') : (r.attemptedIdentifier || r.userId || '');
      lines.push([
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        r.actorType, userLabel, r.action, r.entityType, r.entityId,
        r.requestMethod, r.requestUrl, r.statusCode, r.ipAddress,
        r.reason, r.oldValue, r.newValue,
      ].map(esc).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  }
}
