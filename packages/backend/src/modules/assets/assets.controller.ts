import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssetsService } from './assets.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { AssetStatus } from '../../database/entities/fixed-asset.entity';
import {
  RunDepreciationDto,
  CompleteTransferDto,
  CreateAssetDto,
  UpdateAssetDto,
  RecordAssetMaintenanceDto,
  InitiateTransferDto,
  DisposeAssetDto,
} from './dto/assets.dto';

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
  async createAsset(@Body() data: CreateAssetDto, @Request() req: any) {
    return this.assetsService.createAsset(data, req.user?.tenantId);
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
    @Request() req?: any,
  ) {
    return this.assetsService.listAssets(facilityId, { category, status, departmentId, search }, req.user?.tenantId);
  }

  @Get('register')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset register' })
  async getAssetRegister(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.assetsService.getAssetRegister(facilityId, req.user?.tenantId);
  }

  @Get('valuation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset valuation summary' })
  async getAssetValuation(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.assetsService.getAssetValuation(facilityId, req.user?.tenantId);
  }

  @Get('maintenance-due')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get assets with upcoming maintenance' })
  async getMaintenanceDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getMaintenanceDue(facilityId, daysAhead, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get asset by ID' })
  async getAsset(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.getAsset(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('assets.update')
  @ApiOperation({ summary: 'Update an asset' })
  async updateAsset(@Param('id') id: string, @Body() data: UpdateAssetDto, @Request() req: any) {
    return this.assetsService.updateAsset(id, data, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('assets.delete')
  @ApiOperation({ summary: 'Delete an asset (soft delete)' })
  async deleteAsset(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.deleteAsset(id, req.user?.tenantId);
  }

  // ==================== DEPRECIATION ====================

  @Post('depreciation/run')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Run monthly depreciation' })
  async runDepreciation(
    @Body() data: RunDepreciationDto,
    @Request() req: any,
  ) {
    return this.assetsService.runDepreciation(data.facilityId, data.year, data.month, req.user?.tenantId);
  }

  @Get(':id/depreciation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get depreciation schedule for an asset' })
  async getDepreciationSchedule(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getDepreciationSchedule(assetId, req.user?.tenantId);
  }

  @Get('reports/depreciation')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get depreciation report' })
  async getDepreciationReport(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
    @Query('month') month?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getDepreciationReport(facilityId, year, month, req.user?.tenantId);
  }

  @Get('reports/loss-on-disposal')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get loss on disposal report' })
  async getLossOnDisposalReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    return this.assetsService.getLossOnDisposalReport(
      facilityId,
      new Date(startDate),
      new Date(endDate),
      req.user?.tenantId,
    );
  }

  // ==================== MAINTENANCE ====================

  @Post(':id/maintenance')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Record asset maintenance' })
  async recordMaintenance(@Param('id') assetId: string, @Body() data: RecordAssetMaintenanceDto, @Request() req: any) {
    return this.assetsService.recordMaintenance({ ...data, assetId }, req.user?.tenantId);
  }

  @Get(':id/maintenance')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get maintenance history' })
  async getMaintenanceHistory(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getMaintenanceHistory(assetId, req.user?.tenantId);
  }

  // ==================== TRANSFERS ====================

  @Post(':id/transfer')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Initiate asset transfer' })
  async initiateTransfer(@Param('id') assetId: string, @Body() data: InitiateTransferDto, @Request() req: any) {
    return this.assetsService.initiateTransfer({ ...data, assetId }, req.user?.tenantId);
  }

  @Post('transfers/:transferId/complete')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Complete asset transfer' })
  async completeTransfer(
    @Param('transferId') transferId: string,
    @Body() data: CompleteTransferDto,
    @Request() req: any,
  ) {
    return this.assetsService.completeTransfer(transferId, data.receivedBy, req.user?.tenantId);
  }

  @Get(':id/transfers')
  @AuthWithPermissions('assets.read')
  @ApiOperation({ summary: 'Get transfer history' })
  async getTransferHistory(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getTransferHistory(assetId, req.user?.tenantId);
  }

  // ==================== DISPOSAL ====================

  @Post(':id/dispose')
  @AuthWithPermissions('assets.create')
  @ApiOperation({ summary: 'Dispose an asset' })
  async disposeAsset(@Param('id') id: string, @Body() data: DisposeAssetDto, @Request() req: any) {
    return this.assetsService.disposeAsset(id, data, req.user?.tenantId);
  }
}
