import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DURReportsService } from './dur-reports.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('DUR Reports')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pharmacy')
@Controller('prescriptions/analytics/dur')
export class DURReportsController {
  constructor(private readonly durService: DURReportsService) {}

  @Get('prescribing-patterns')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get top prescribed drugs with counts and averages' })
  getPrescribingPatterns(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.durService.getPrescribingPatterns(
      req?.user?.tenantId,
      facilityId,
      dateFrom,
      dateTo,
    );
  }

  @Get('therapeutic-trends')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get therapeutic class trends over time' })
  getTherapeuticTrends(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.durService.getTherapeuticClassTrends(
      req?.user?.tenantId,
      facilityId,
      dateFrom,
      dateTo,
    );
  }

  @Get('prescriber-stats')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get per-prescriber analytics' })
  getPrescriberStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.durService.getPrescriberAnalytics(
      req?.user?.tenantId,
      facilityId,
      dateFrom,
      dateTo,
    );
  }

  @Get('summary')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get combined DUR summary with key metrics' })
  getSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.durService.getDURSummary(req?.user?.tenantId, facilityId, dateFrom, dateTo);
  }
}
