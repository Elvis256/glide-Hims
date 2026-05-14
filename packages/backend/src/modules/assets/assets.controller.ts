import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AssetsService } from './assets.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  AssetStatus,
  AssetStatus as _AssetStatus,
  TransferApprovalStage,
  DisposalStatus,
} from '../../database/entities/fixed-asset.entity';
import {
  RunDepreciationDto,
  CompleteTransferDto,
  CreateAssetDto,
  UpdateAssetDto,
  RecordAssetMaintenanceDto,
  InitiateTransferDto,
  DisposeAssetDto,
  ApproveTransferDto,
  CompleteTransferReceiptDto,
  CreateAllocationDto,
  ApproveAllocationDto,
  ReturnAllocationDto,
  CreateDisposalRequestDto,
  BiomedReviewDto,
  CommitteeDecisionDto,
  CompleteDisposalDto,
  CreateAssetCategoryDto,
  UpdateAssetCategoryDto,
  RecordLocationDto,
} from './dto/assets.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

function actorCtx(req: any) {
  return {
    userId: req?.user?.id || req?.user?.userId,
    tenantId: req?.user?.tenantId,
    ip: req?.ip,
    ua: req?.headers?.['user-agent'],
  };
}

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseGuards(ModuleGuard)
@RequireModule('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ==================== ASSET CRUD ====================

  @Post()
  @AuthWithPermissions('assets.create')
  async createAsset(@Body() data: CreateAssetDto, @Request() req: any) {
    return this.assetsService.createAsset(data as any, actorCtx(req));
  }

  @Get()
  @AuthWithPermissions('assets.read')
  async listAssets(
    @Query('facilityId') facilityId: string,
    @Query('category') category?: string,
    @Query('categoryId') categoryId?: string,
    @Query('assetClass') assetClass?: string,
    @Query('criticalityLevel') criticalityLevel?: string,
    @Query('status') status?: AssetStatus,
    @Query('departmentId') departmentId?: string,
    @Query('custodianId') custodianId?: string,
    @Query('search') search?: string,
    @Request() req?: any,
  ) {
    return this.assetsService.listAssets(
      facilityId,
      { category, categoryId, assetClass, criticalityLevel, status, departmentId, custodianId, search },
      req.user?.tenantId,
    );
  }

  @Get('register')
  @AuthWithPermissions('assets.read')
  async getAssetRegister(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.assetsService.getAssetRegister(facilityId, req.user?.tenantId);
  }

  @Get('valuation')
  @AuthWithPermissions('assets.read')
  async getAssetValuation(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.assetsService.getAssetValuation(facilityId, req.user?.tenantId);
  }

  @Get('maintenance-due')
  @AuthWithPermissions('assets.read')
  async getMaintenanceDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getMaintenanceDue(facilityId, Number(daysAhead) || 30, req.user?.tenantId);
  }

  @Get('calibration-due')
  @AuthWithPermissions('assets.read')
  async getCalibrationDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getCalibrationDue(facilityId, Number(daysAhead) || 30, req.user?.tenantId);
  }

  @Get('amc-expiring')
  @AuthWithPermissions('assets.read')
  async getAmcExpiring(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getAmcExpiring(facilityId, Number(daysAhead) || 60, req.user?.tenantId);
  }

  @Get('warranty-expiring')
  @AuthWithPermissions('assets.read')
  async getWarrantyExpiring(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.assetsService.getWarrantyExpiring(facilityId, Number(daysAhead) || 60, req.user?.tenantId);
  }

  // ==================== CATEGORIES (must come before :id route) ====================

  @Get('categories')
  @AuthWithPermissions('assets.read')
  async listCategories(
    @Query('assetClass') assetClass?: string,
    @Query('isActive') isActive?: string,
    @Request() req?: any,
  ) {
    const filters: any = {};
    if (assetClass) filters.assetClass = assetClass;
    if (isActive !== undefined) filters.isActive = isActive === 'true' || isActive === '1';
    return this.assetsService.listCategories(filters, req?.user?.tenantId);
  }

  @Post('categories')
  @AuthWithPermissions('assets.categories.manage')
  async createCategory(@Body() data: CreateAssetCategoryDto, @Request() req: any) {
    return this.assetsService.createCategory(data, actorCtx(req));
  }

  @Put('categories/:id')
  @AuthWithPermissions('assets.categories.manage')
  async updateCategory(
    @Param('id') id: string,
    @Body() data: UpdateAssetCategoryDto,
    @Request() req: any,
  ) {
    return this.assetsService.updateCategory(id, data, actorCtx(req));
  }

  @Delete('categories/:id')
  @AuthWithPermissions('assets.categories.manage')
  async deleteCategory(@Param('id') id: string, @Request() req: any) {
    await this.assetsService.deleteCategory(id, actorCtx(req));
    return { ok: true };
  }

  // ==================== ALLOCATIONS ====================

  @Get('allocations')
  @AuthWithPermissions('assets.read')
  async listAllocations(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Query('custodianId') custodianId?: string,
    @Query('assetId') assetId?: string,
    @Request() req?: any,
  ) {
    return this.assetsService.listAllocations(
      facilityId,
      { status, custodianId, assetId },
      req?.user?.tenantId,
    );
  }

  @Post('allocations')
  @AuthWithPermissions('assets.allocation.request')
  async createAllocation(@Body() data: CreateAllocationDto, @Request() req: any) {
    return this.assetsService.createAllocation(data, actorCtx(req));
  }

  @Put('allocations/:id/approve')
  @AuthWithPermissions('assets.allocation.approve')
  async approveAllocation(
    @Param('id') id: string,
    @Body() data: ApproveAllocationDto,
    @Request() req: any,
  ) {
    return this.assetsService.approveAllocation(id, data.decision, data.comments, actorCtx(req));
  }

  @Put('allocations/:id/issue')
  @AuthWithPermissions('assets.allocation.issue')
  async issueAllocation(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.issueAllocation(id, actorCtx(req));
  }

  @Put('allocations/:id/return')
  @AuthWithPermissions('assets.allocation.return')
  async returnAllocation(
    @Param('id') id: string,
    @Body() data: ReturnAllocationDto,
    @Request() req: any,
  ) {
    return this.assetsService.returnAllocation(
      id,
      data.returnDate,
      data.conditionOnReturn,
      data.notes,
      actorCtx(req),
    );
  }

  // ==================== DISPOSAL WORKFLOW ====================

  @Get('disposals')
  @AuthWithPermissions('assets.read')
  async listDisposals(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Request() req?: any,
  ) {
    return this.assetsService.listDisposals(facilityId, { status, method }, req?.user?.tenantId);
  }

  @Post('disposals')
  @AuthWithPermissions('assets.disposal.request')
  async createDisposalRequest(@Body() data: CreateDisposalRequestDto, @Request() req: any) {
    return this.assetsService.createDisposalRequest(data, actorCtx(req));
  }

  @Put('disposals/:id/biomed-review')
  @AuthWithPermissions('assets.disposal.biomed_review')
  async biomedReview(
    @Param('id') id: string,
    @Body() data: BiomedReviewDto,
    @Request() req: any,
  ) {
    return this.assetsService.biomedReview(id, data.assessment, data.recommendation, actorCtx(req));
  }

  @Put('disposals/:id/committee-decision')
  @AuthWithPermissions('assets.disposal.committee')
  async committeeDecision(
    @Param('id') id: string,
    @Body() data: CommitteeDecisionDto,
    @Request() req: any,
  ) {
    return this.assetsService.committeeDecision(
      id,
      data.role,
      data.decision,
      data.comments,
      actorCtx(req),
    );
  }

  @Put('disposals/:id/complete')
  @AuthWithPermissions('assets.disposal.complete')
  async completeDisposal(
    @Param('id') id: string,
    @Body() data: CompleteDisposalDto,
    @Request() req: any,
  ) {
    return this.assetsService.completeDisposal(id, data, actorCtx(req));
  }

  // ==================== TRANSFERS ====================

  @Get('transfers')
  @AuthWithPermissions('assets.read')
  async listTransfers(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.assetsService.listTransfers(facilityId, status, req?.user?.tenantId);
  }

  @Post(':id/transfer')
  @AuthWithPermissions('assets.transfer.initiate')
  async initiateTransfer(
    @Param('id') assetId: string,
    @Body() data: InitiateTransferDto,
    @Request() req: any,
  ) {
    return this.assetsService.initiateTransfer({ ...data, assetId } as any, actorCtx(req));
  }

  @Put('transfers/:transferId/approve')
  @AuthWithPermissions('assets.transfer.approve')
  async approveTransferStage(
    @Param('transferId') transferId: string,
    @Body() data: ApproveTransferDto,
    @Request() req: any,
  ) {
    return this.assetsService.approveTransferStage(
      transferId,
      data.stage as TransferApprovalStage,
      data.decision,
      data.comments,
      actorCtx(req),
    );
  }

  @Post('transfers/:transferId/complete')
  @AuthWithPermissions('assets.transfer.complete')
  async completeTransfer(
    @Param('transferId') transferId: string,
    @Body() data: CompleteTransferReceiptDto,
    @Request() req: any,
  ) {
    return this.assetsService.completeTransfer(
      transferId,
      data.receivedBy || req.user?.id || req.user?.userId,
      data.conditionOnReceipt,
      actorCtx(req),
    );
  }

  // FE-compat alias: PUT /assets/transfers/:id/complete (some FE versions used PUT)
  @Put('transfers/:transferId/complete')
  @AuthWithPermissions('assets.transfer.complete')
  async completeTransferAlias(
    @Param('transferId') transferId: string,
    @Body() data: CompleteTransferReceiptDto,
    @Request() req: any,
  ) {
    return this.completeTransfer(transferId, data, req);
  }

  @Get(':id/transfers')
  @AuthWithPermissions('assets.read')
  async getTransferHistory(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getTransferHistory(assetId, req.user?.tenantId);
  }

  // ==================== LEGACY QUICK-DISPOSE ====================

  @Post(':id/dispose')
  @AuthWithPermissions('assets.disposal.complete')
  async disposeAsset(@Param('id') id: string, @Body() data: DisposeAssetDto, @Request() req: any) {
    return this.assetsService.disposeAsset(
      id,
      {
        disposalDate: data.disposalDate ? new Date(data.disposalDate) : new Date(),
        disposalValue: Number(data.disposalValue) || 0,
        disposalReason: data.reason || '',
        status: AssetStatus.DISPOSED,
      },
      actorCtx(req),
    );
  }

  // ==================== DEPRECIATION ====================

  @Post('depreciation/run')
  @AuthWithPermissions('assets.depreciation.run')
  async runDepreciation(@Body() data: RunDepreciationDto, @Request() req: any) {
    return this.assetsService.runDepreciation(data.facilityId, data.year, data.month, actorCtx(req));
  }

  @Get('reports/depreciation')
  @AuthWithPermissions('assets.read')
  async getDepreciationReport(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
    @Query('month') month?: number,
    @Request() req?: any,
  ) {
    const yr = Number(year);
    const safeYear = Number.isFinite(yr) && yr > 1900 ? yr : new Date().getFullYear();
    const mn = month !== undefined ? Number(month) : undefined;
    const safeMonth = mn !== undefined && Number.isFinite(mn) && mn >= 1 && mn <= 12 ? mn : undefined;
    return this.assetsService.getDepreciationReport(
      facilityId,
      safeYear,
      safeMonth,
      req?.user?.tenantId,
    );
  }

  @Get(':id/depreciation')
  @AuthWithPermissions('assets.read')
  async getDepreciationSchedule(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getDepreciationSchedule(assetId, req.user?.tenantId);
  }

  // FE-compat alias
  @Get('depreciation/report')
  @AuthWithPermissions('assets.read')
  async getDepreciationReportAlias(
    @Query('facilityId') facilityId: string,
    @Query('year') year: number,
    @Query('month') month?: number,
    @Request() req?: any,
  ) {
    return this.getDepreciationReport(facilityId, year, month, req);
  }

  @Get('reports/loss-on-disposal')
  @AuthWithPermissions('assets.read')
  async getLossOnDisposalReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    const { start, end } = this.resolveDateRange(startDate, endDate);
    return this.assetsService.getLossOnDisposalReport(
      facilityId,
      start,
      end,
      req?.user?.tenantId,
    );
  }

  @Get('reports/age-analysis')
  @AuthWithPermissions('assets.read')
  async getAgeAnalysis(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.assetsService.getAgeAnalysisReport(facilityId, req.user?.tenantId);
  }

  @Get('reports/maintenance-cost')
  @AuthWithPermissions('assets.read')
  async getMaintenanceCostReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    const { start, end } = this.resolveDateRange(startDate, endDate);
    return this.assetsService.getMaintenanceCostReport(
      facilityId,
      start,
      end,
      req?.user?.tenantId,
    );
  }

  private resolveDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
    const parse = (s?: string): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const end = parse(endDate) ?? new Date();
    const start = parse(startDate) ?? new Date(end.getTime() - 365 * 24 * 3600 * 1000);
    return { start, end };
  }

  // ==================== MAINTENANCE ====================

  @Post(':id/maintenance')
  @AuthWithPermissions('assets.maintenance.record')
  async recordMaintenance(
    @Param('id') assetId: string,
    @Body() data: RecordAssetMaintenanceDto,
    @Request() req: any,
  ) {
    return this.assetsService.recordMaintenance(
      {
        ...(data as any),
        type: (data as any).maintenanceType || (data as any).type,
        nextDueDate: (data as any).nextMaintenanceDate
          ? new Date((data as any).nextMaintenanceDate)
          : undefined,
        maintenanceDate: (data as any).maintenanceDate
          ? new Date((data as any).maintenanceDate)
          : new Date(),
        assetId,
      } as any,
      actorCtx(req),
    );
  }

  @Get(':id/maintenance')
  @AuthWithPermissions('assets.read')
  async getMaintenanceHistory(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getMaintenanceHistory(assetId, req.user?.tenantId);
  }

  // ==================== LOCATION HISTORY ====================

  @Get(':id/location-history')
  @AuthWithPermissions('assets.read')
  async getLocationHistory(@Param('id') assetId: string, @Request() req: any) {
    return this.assetsService.getLocationHistory(assetId, req.user?.tenantId);
  }

  @Post(':id/location')
  @AuthWithPermissions('assets.update')
  async recordLocation(
    @Param('id') assetId: string,
    @Body() data: RecordLocationDto,
    @Request() req: any,
  ) {
    return this.assetsService.recordLocation(assetId, data, actorCtx(req));
  }

  // ==================== ASSET BY ID (catch-all — last) ====================

  @Get(':id')
  @AuthWithPermissions('assets.read')
  async getAsset(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.getAsset(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('assets.update')
  async updateAsset(@Param('id') id: string, @Body() data: UpdateAssetDto, @Request() req: any) {
    return this.assetsService.updateAsset(id, data as any, actorCtx(req));
  }

  @Delete(':id')
  @AuthWithPermissions('assets.delete')
  async deleteAsset(@Param('id') id: string, @Request() req: any) {
    await this.assetsService.deleteAsset(id, actorCtx(req));
    return { ok: true };
  }
}
