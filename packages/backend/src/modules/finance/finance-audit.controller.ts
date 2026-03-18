import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FinanceAuditService } from './finance-audit.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Finance Audit')
@ApiBearerAuth()
@Controller('finance/audit-log')
export class FinanceAuditController {
  constructor(private readonly auditService: FinanceAuditService) {}

  @Get()
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get finance audit log entries' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.auditService.findAll(
      {
        entityType,
        entityId,
        userId,
        facilityId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      req?.user?.tenantId,
    );
  }
}
