import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../../modules/auth/decorators/auth.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @AuthWithPermissions('admin.audit')
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
  ) {
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
    });
  }

  @Get('stats')
  @AuthWithPermissions('admin.audit')
  @ApiOperation({ summary: 'Get audit log statistics' })
  async getStats() {
    return this.auditLogService.getStats();
  }
}
