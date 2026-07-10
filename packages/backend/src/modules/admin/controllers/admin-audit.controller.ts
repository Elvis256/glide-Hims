import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminAuditService } from '../services/admin-audit.service';
import {
  AdminAuditLog,
  AdminAuditAction,
  AdminAuditEntityType,
} from '../../../database/entities/admin-audit-log.entity';
import {
  QueryAuditLogsDto,
  GetEntityAuditTrailDto,
  ExportAuditLogsDto,
  AdminActivityReportDto,
} from '../dto/admin-audit.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../../database/entities/user.entity';
import { SystemAdminOnly } from '../../auth/decorators/system-admin-only.decorator';

/**
 * Admin Audit Log API
 * Compliance-focused endpoints for audit trail viewing and reporting
 *
 * Access: System Admins only
 * Uses: AdminAuditService for querying and AdminAuditSubscriber for auto-logging
 */
@ApiTags('admin/audit-logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@SystemAdminOnly()
export class AdminAuditController {
  constructor(private auditService: AdminAuditService) {}

  /**
   * Query audit logs with flexible filtering
   * Returns paginated results ordered by most recent first
   */
  @Get('/')
  @ApiOperation({ summary: 'Query audit logs with filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit logs',
    schema: {
      properties: {
        data: { type: 'array', description: 'Audit log entries' },
        total: { type: 'number', description: 'Total count' },
      },
    },
  })
  async queryAuditLogs(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() user: User,
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.auditService.queryAuditLogs({
      adminUserId: query.adminUserId,
      tenantId: query.tenantId,
      action: query.action as AdminAuditAction,
      entityType: query.entityType as AdminAuditEntityType,
      entityId: query.entityId,
      startDate,
      endDate,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });
  }

  /**
   * Get complete audit trail for a specific entity
   * Shows all changes (create, updates, delete) in chronological order
   */
  @Get('/entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit trail for a specific entity' })
  @ApiResponse({
    status: 200,
    description: 'Complete audit trail for the entity',
    type: [AdminAuditLog],
  })
  async getEntityAuditTrail(
    @Param() params: GetEntityAuditTrailDto,
    @CurrentUser() user: User,
  ): Promise<AdminAuditLog[]> {
    return this.auditService.getEntityAuditTrail(
      params.entityType as AdminAuditEntityType,
      params.entityId,
    );
  }

  /**
   * Get all actions performed by a specific admin
   * Useful for investigating suspicious activity or compliance reviews
   */
  @Get('/admin/:adminUserId')
  @ApiOperation({ summary: 'Get audit trail for a specific admin user' })
  @ApiResponse({ status: 200, description: 'Admin activity log', type: [AdminAuditLog] })
  async getAdminActivityLog(
    @Param('adminUserId') adminUserId: string,
    @Query('hours') hours: string,
    @Query('limit') limit: string,
    @CurrentUser() user: User,
  ): Promise<AdminAuditLog[]> {
    const since = hours ? new Date(Date.now() - parseInt(hours) * 3600000) : undefined;
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.auditService.getAdminActivityLog(adminUserId, {
      startDate: since,
      limit: limitNum,
    });
  }

  /**
   * Get all changes to a specific tenant
   * Useful for tenant-level compliance audits
   */
  @Get('/tenant/:tenantId')
  @ApiOperation({ summary: 'Get complete audit trail for a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant audit trail', type: [AdminAuditLog] })
  async getTenantAuditTrail(
    @Param('tenantId') tenantId: string,
    @Query('limit') limit: string,
    @CurrentUser() user: User,
  ): Promise<AdminAuditLog[]> {
    return this.auditService.getTenantAuditTrail(tenantId, limit ? parseInt(limit) : 1000);
  }

  /**
   * Search audit logs by description or change reason
   * Useful for finding specific changes by ticket number, policy, etc.
   */
  @Post('/search')
  @ApiOperation({ summary: 'Search audit logs by keyword' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      properties: {
        data: { type: 'array' },
        total: { type: 'number' },
      },
    },
  })
  @HttpCode(200)
  async searchAuditLogs(
    @Body('searchTerm') searchTerm: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @CurrentUser() user: User,
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    if (!searchTerm || searchTerm.length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters');
    }

    return this.auditService.searchAuditLogs(searchTerm, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  /**
   * Get action statistics for dashboard display
   * Shows count of each action type in specified period
   */
  @Get('/stats/actions')
  @ApiOperation({ summary: 'Get audit action statistics' })
  @ApiResponse({
    status: 200,
    description: 'Action counts by type',
    schema: { type: 'object', additionalProperties: { type: 'number' } },
  })
  async getActionStats(
    @Query('tenantId') tenantId: string,
    @Query('hours') hours: string,
    @CurrentUser() user: User,
  ): Promise<Record<string, number>> {
    const since = hours ? new Date(Date.now() - parseInt(hours) * 3600000) : undefined;
    return this.auditService.getActionStats(tenantId, since);
  }

  /**
   * Detect suspicious activity patterns
   * Returns recent failures or unusual actions that warrant investigation
   */
  @Get('/anomalies')
  @ApiOperation({ summary: 'Detect suspicious activity patterns' })
  @ApiResponse({
    status: 200,
    description: 'Anomalies detected in recent activity',
    type: [AdminAuditLog],
  })
  async detectAnomalies(
    @Query('hours') hours: string,
    @CurrentUser() user: User,
  ): Promise<AdminAuditLog[]> {
    return this.auditService.detectAnomalies(hours ? parseInt(hours) : 24);
  }

  /**
   * Export audit logs in CSV or JSON format
   * Used for compliance reporting and external audit requirements
   */
  @Post('/export')
  @ApiOperation({ summary: 'Export audit logs (CSV or JSON)' })
  @ApiResponse({
    status: 200,
    description: 'Exported audit logs as attachment',
    schema: { type: 'string', format: 'binary' },
  })
  @HttpCode(200)
  async exportAuditLogs(
    @Body() dto: ExportAuditLogsDto,
    @Res() response: Response,
    @CurrentUser() user: User,
  ): Promise<void> {
    const format = (dto.format || 'json') as 'csv' | 'json';

    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    const data = await this.auditService.exportAuditLogs(
      {
        adminUserId: dto.adminUserId,
        tenantId: dto.tenantId,
        action: dto.action as AdminAuditAction,
        entityType: dto.entityType as AdminAuditEntityType,
        entityId: dto.entityId,
        startDate,
        endDate,
      },
      format,
    );

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(data);
  }

  /**
   * Generate compliance report
   * Shows specific compliance metrics and findings
   */
  @Post('/compliance-report')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({
    status: 200,
    description: 'Compliance report',
    schema: {
      properties: {
        period: { type: 'string' },
        totalEvents: { type: 'number' },
        actionBreakdown: { type: 'object' },
        adminActivity: { type: 'array' },
        suspiciousActivity: { type: 'array' },
      },
    },
  })
  @HttpCode(200)
  async generateComplianceReport(
    @Body() dto: AdminActivityReportDto,
    @CurrentUser() user: User,
  ): Promise<any> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const { data, total } = await this.auditService.queryAuditLogs({
      startDate,
      endDate,
      tenantId: dto.tenantId,
      limit: 10000,
    });

    const actionStats = await this.auditService.getActionStats(dto.tenantId, startDate);
    const anomalies = await this.auditService.detectAnomalies(
      Math.ceil((endDate.getTime() - startDate.getTime()) / 3600000),
    );

    return {
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      totalEvents: total,
      tenantId: dto.tenantId || 'all',
      actionBreakdown: actionStats,
      adminActivity: data.slice(0, 20),
      suspiciousActivity: anomalies,
      reportGeneratedAt: new Date(),
    };
  }

  /**
   * Verify audit log integrity
   * Checks if a specific log has been tampered with
   */
  @Get('/verify/:logId')
  @ApiOperation({ summary: 'Verify audit log integrity' })
  @ApiResponse({
    status: 200,
    description: 'Integrity verification result',
    schema: {
      properties: {
        valid: { type: 'boolean' },
        checksum: { type: 'string' },
      },
    },
  })
  async verifyLogIntegrity(
    @Param('logId') logId: string,
    @CurrentUser() user: User,
  ): Promise<{ valid: boolean; checksum?: string }> {
    return this.auditService.verifyLogIntegrity(logId);
  }

  /**
   * Archive old logs (runs periodically, can be triggered manually)
   * Moves logs older than retention period to cold storage
   */
  @Post('/archive-old')
  @ApiOperation({ summary: 'Archive audit logs older than retention period' })
  @ApiResponse({
    status: 200,
    description: 'Archive operation result',
    schema: {
      properties: {
        archivedCount: { type: 'number' },
        beforeDate: { type: 'string' },
      },
    },
  })
  @HttpCode(200)
  async archiveOldLogs(
    @Query('before') beforeDate: string,
    @CurrentUser() user: User,
  ): Promise<{ archivedCount: number; beforeDate: string }> {
    if (!beforeDate) {
      throw new BadRequestException('before date parameter is required');
    }

    const date = new Date(beforeDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format (use ISO 8601)');
    }

    const archivedCount = await this.auditService.archiveOldLogs(date);

    return { archivedCount, beforeDate };
  }
}
