import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssetsService } from './assets.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { AssetStatus } from '../../database/entities/fixed-asset.entity';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ==================== ASSET CRUD ====================

  @Post()
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Create a new fixed asset' })
  async createAsset(@Body() data: any) {
    return this.assetsService.createAsset(data);
  }

  @Get()
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'List assets by facility' })
  async listAssets(
    @Query('facilityId') facilityId: string,
    @Query('category') category?: string,
    @Query('status') status?: AssetStatus,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
  ) {
    return this.assetsService.listAssets(facilityId, { category, status, departmentId, search });
  }

  @Get('register')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset register' })
  async getAssetRegister(@Query('facilityId') facilityId: string) {
    return this.assetsService.getAssetRegister(facilityId);
  }

  @Get('valuation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset valuation summary' })
  async getAssetValuation(@Query('facilityId') facilityId: string) {
    return this.assetsService.getAssetValuation(facilityId);
  }

  @Get('maintenance-due')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get assets with upcoming maintenance' })
  async getMaintenanceDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
  ) {
    return this.assetsService.getMaintenanceDue(facilityId, daysAhead);
  }

  @Get(':id')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset by ID' })
  async getAsset(@Param('id') id: string) {
    return this.assetsService.getAsset(id);
  }

  @Put(':id')
  @AuthWithPermissions('assets.update')
  @ApiOperation({ summary: 'Update an asset' })
  async updateAsset(@Param('id') id: string, @Body() data: any) {
    return this.assetsService.updateAsset(id, data);
  }

  @Delete(':id')
  @AuthWithPermissions('assets.delete')
  @ApiOperation({ summary: 'Delete an asset (soft delete)' })
  async deleteAsset(@Param('id') id: string) {
    return this.assetsService.deleteAsset(id);
  }

  // ==================== DEPRECIATION ====================

  @Post('depreciation/run')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Run monthly depreciation' })
  async runDepreciation(
    @Body() data: { facilityId: string; year: number; month: number },
  ) {
    return this.assetsService.runDepreciation(data.facilityId, data.year, data.month);
  }

  @Get(':id/depreciation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get depreciation schedule for an asset' })
  async getDepreciationSchedule(@Param('id') assetId: string) {
    return this.assetsService.getDepreciationSchedule(assetId);
  }

  @Get('reports/depreciation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get depreciation report' })
  async getDepreciationReport(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
    @Query('month') month?: number,
  ) {
    return this.assetsService.getDepreciationReport(facilityId, year, month);
  }

  @Get('reports/loss-on-disposal')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get loss on disposal report' })
  async getLossOnDisposalReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.assetsService.getLossOnDisposalReport(
      facilityId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  // ==================== MAINTENANCE ====================

  @Post(':id/maintenance')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Record asset maintenance' })
  async recordMaintenance(@Param('id') assetId: string, @Body() data: any) {
    return this.assetsService.recordMaintenance({ ...data, assetId });
  }

  @Get(':id/maintenance')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get maintenance history' })
  async getMaintenanceHistory(@Param('id') assetId: string) {
    return this.assetsService.getMaintenanceHistory(assetId);
  }

  // ==================== TRANSFERS ====================

  @Post(':id/transfer')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Initiate asset transfer' })
  async initiateTransfer(@Param('id') assetId: string, @Body() data: any) {
    return this.assetsService.initiateTransfer({ ...data, assetId });
  }

  @Post('transfers/:transferId/complete')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Complete asset transfer' })
  async completeTransfer(
    @Param('transferId') transferId: string,
    @Body() data: { receivedBy: string },
  ) {
    return this.assetsService.completeTransfer(transferId, data.receivedBy);
  }

  @Get(':id/transfers')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get transfer history' })
  async getTransferHistory(@Param('id') assetId: string) {
    return this.assetsService.getTransferHistory(assetId);
  }

  // ==================== DISPOSAL ====================

  @Post(':id/dispose')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Dispose an asset' })
  async disposeAsset(@Param('id') id: string, @Body() data: any) {
    return this.assetsService.disposeAsset(id, data);
  }
}
