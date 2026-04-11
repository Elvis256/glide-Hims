import { Controller, Get, Post, Put, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LabSuppliesService } from './lab-supplies.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateReagentDto,
  UpdateReagentDto,
  ReceiveLotDto,
  RecordConsumptionDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
  RecordCalibrationDto,
  RecordMaintenanceDto,
  CreateQCMaterialDto,
  RecordQCResultDto,
} from './dto/lab-supplies.dto';

@ApiTags('Lab Supplies')
@ApiBearerAuth()
@Controller('lab-supplies')
export class LabSuppliesController {
  constructor(private readonly labSuppliesService: LabSuppliesService) {}

  // ==================== REAGENTS ====================

  @AuthWithPermissions('inventory.create')
  @Post('reagents')
  @ApiOperation({ summary: 'Create a new reagent' })
  async createReagent(@Body() data: CreateReagentDto, @Request() req: any) {
    return this.labSuppliesService.createReagent(data as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('reagents')
  @ApiOperation({ summary: 'List reagents' })
  async listReagents(
    @Query('facilityId') facilityId: string,
    @Query('category') category: string | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.listReagents(facilityId, category, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('reagents/low-stock')
  @ApiOperation({ summary: 'Get low stock reagents' })
  async getLowStockReagents(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.labSuppliesService.getLowStockReagents(facilityId, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('reagents/expiring')
  @ApiOperation({ summary: 'Get expiring reagent lots' })
  async getExpiringReagents(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getExpiringReagents(facilityId, daysAhead, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('reagents/consumption-report')
  @ApiOperation({ summary: 'Get reagent consumption report' })
  async getConsumptionReport(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getConsumptionReport(
      facilityId,
      new Date(startDate),
      new Date(endDate),
      req.user?.tenantId,
    );
  }

  @AuthWithPermissions('inventory.read')
  @Get('reagents/:id')
  @ApiOperation({ summary: 'Get reagent by ID' })
  async getReagent(@Param('id') id: string, @Request() req: any) {
    return this.labSuppliesService.getReagent(id, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Put('reagents/:id')
  @ApiOperation({ summary: 'Update reagent' })
  async updateReagent(@Param('id') id: string, @Body() data: UpdateReagentDto, @Request() req: any) {
    return this.labSuppliesService.updateReagent(id, data as any, req.user?.tenantId);
  }

  // ==================== REAGENT LOTS ====================

  @AuthWithPermissions('inventory.create')
  @Post('reagents/:reagentId/lots')
  @ApiOperation({ summary: 'Receive a new reagent lot' })
  async receiveLot(@Param('reagentId') reagentId: string, @Body() data: ReceiveLotDto, @Request() req: any) {
    return this.labSuppliesService.receiveLot({ ...data, reagentId } as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Post('lots/:lotId/open')
  @ApiOperation({ summary: 'Open a reagent lot' })
  async openLot(@Param('lotId') lotId: string, @Request() req: any) {
    return this.labSuppliesService.openLot(lotId, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Post('lots/:lotId/consume')
  @ApiOperation({ summary: 'Record reagent consumption' })
  async recordConsumption(@Param('lotId') lotId: string, @Body() data: RecordConsumptionDto, @Request() req: any) {
    return this.labSuppliesService.recordConsumption({ ...data, lotId }, req.user?.tenantId);
  }

  // ==================== EQUIPMENT ====================

  @AuthWithPermissions('inventory.create')
  @Post('equipment')
  @ApiOperation({ summary: 'Create lab equipment' })
  async createEquipment(@Body() data: CreateEquipmentDto, @Request() req: any) {
    return this.labSuppliesService.createEquipment(data as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('equipment')
  @ApiOperation({ summary: 'List lab equipment' })
  async listEquipment(
    @Query('facilityId') facilityId: string,
    @Query('category') category: string | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.listEquipment(facilityId, category, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('equipment/calibration-due')
  @ApiOperation({ summary: 'Get equipment due for calibration' })
  async getCalibrationDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getEquipmentDueForCalibration(facilityId, daysAhead, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('equipment/:id')
  @ApiOperation({ summary: 'Get equipment by ID' })
  async getEquipment(@Param('id') id: string, @Request() req: any) {
    return this.labSuppliesService.getEquipment(id, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Put('equipment/:id')
  @ApiOperation({ summary: 'Update equipment' })
  async updateEquipment(@Param('id') id: string, @Body() data: UpdateEquipmentDto, @Request() req: any) {
    return this.labSuppliesService.updateEquipment(id, data as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Post('equipment/:id/calibration')
  @ApiOperation({ summary: 'Record equipment calibration' })
  async recordCalibration(@Param('id') equipmentId: string, @Body() data: RecordCalibrationDto, @Request() req: any) {
    return this.labSuppliesService.recordCalibration({ ...data, equipmentId } as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.update')
  @Post('equipment/:id/maintenance')
  @ApiOperation({ summary: 'Record equipment maintenance' })
  async recordMaintenance(@Param('id') equipmentId: string, @Body() data: RecordMaintenanceDto, @Request() req: any) {
    return this.labSuppliesService.recordEquipmentMaintenance({ ...data, equipmentId } as any, req.user?.tenantId);
  }

  // ==================== QC MATERIALS ====================

  @AuthWithPermissions('inventory.create')
  @Post('qc-materials')
  @ApiOperation({ summary: 'Create QC material' })
  async createQCMaterial(@Body() data: CreateQCMaterialDto, @Request() req: any) {
    return this.labSuppliesService.createQCMaterial(data as any, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('qc-materials')
  @ApiOperation({ summary: 'List QC materials' })
  async listQCMaterials(
    @Query('facilityId') facilityId: string,
    @Query('testCode') testCode: string | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.listQCMaterials(facilityId, testCode, req.user?.tenantId);
  }

  // ==================== QC RESULTS ====================

  @AuthWithPermissions('inventory.create')
  @Post('qc-results')
  @ApiOperation({ summary: 'Record QC result' })
  async recordQCResult(@Body() data: RecordQCResultDto, @Request() req: any) {
    return this.labSuppliesService.recordQCResult(data, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('qc-results')
  @ApiOperation({ summary: 'Get QC results' })
  async getQCResults(
    @Query('facilityId') facilityId: string,
    @Query('testCode') testCode: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getQCResults(
      facilityId,
      testCode,
      new Date(startDate),
      new Date(endDate),
      req.user?.tenantId,
    );
  }

  @AuthWithPermissions('inventory.read')
  @Get('qc-results/levey-jennings/:materialId')
  @ApiOperation({ summary: 'Get Levey-Jennings chart data' })
  async getLeveyJenningsData(
    @Param('materialId') materialId: string,
    @Query('months') months: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getLeveyJenningsData(materialId, months, req.user?.tenantId);
  }

  @AuthWithPermissions('inventory.read')
  @Get('qc-results/summary')
  @ApiOperation({ summary: 'Get QC summary report' })
  async getQCSummaryReport(
    @Query('facilityId') facilityId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getQCSummaryReport(facilityId, month, year, req.user?.tenantId);
  }
}
