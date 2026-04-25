import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DrugDbSyncService } from './drug-db-sync.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Drug Database Sync')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pharmacy')
@Controller('drug-management/sync')
export class DrugDbSyncController {
  constructor(private readonly syncService: DrugDbSyncService) {}

  @Post('interactions')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Trigger drug interaction sync from OpenFDA' })
  async syncInteractions(@Request() req: any) {
    return this.syncService.syncDrugInteractions(req.user?.tenantId);
  }

  @Post('labels/:drugName')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Sync FDA label data for a specific drug' })
  async syncLabels(@Param('drugName') drugName: string, @Request() req: any) {
    return this.syncService.syncDrugLabels(drugName, req.user?.tenantId);
  }

  @Get('status')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get current sync status' })
  async getSyncStatus(@Request() req: any) {
    return this.syncService.getSyncStatus(req.user?.tenantId);
  }

  @Get('logs')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get sync history logs' })
  async getSyncLogs(@Request() req: any) {
    return this.syncService.getLastSyncLog(req.user?.tenantId);
  }
}
