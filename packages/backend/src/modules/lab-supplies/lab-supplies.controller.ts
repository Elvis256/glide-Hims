import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LabSuppliesService } from './lab-supplies.service';

@ApiTags('Lab Supplies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('lab-supplies')
export class LabSuppliesController {
  constructor(private readonly labSuppliesService: LabSuppliesService) {}

  // ==================== REAGENTS ====================

  @Post('reagents')
  @ApiOperation({ summary: 'Create a new reagent' })
  async createReagent(@Body() data: any, @Request() req: any) {
    return this.labSuppliesService.createReagent(data, req.user?.tenantId);
  }

  @Get('reagents')
  @ApiOperation({ summary: 'List reagents' })
  async listReagents(
    @Query('facilityId') facilityId: string,
    @Query('category') category: string | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.listReagents(facilityId, category, req.user?.tenantId);
  }

  @Get('reagents/low-stock')
  @ApiOperation({ summary: 'Get low stock reagents' })
  async getLowStockReagents(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.labSuppliesService.getLowStockReagents(facilityId, req.user?.tenantId);
  }

  @Get('reagents/expiring')
  @ApiOperation({ summary: 'Get expiring reagent lots' })
  async getExpiringReagents(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getExpiringReagents(facilityId, daysAhead, req.user?.tenantId);
  }

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

  @Get('reagents/:id')
  @ApiOperation({ summary: 'Get reagent by ID' })
  async getReagent(@Param('id') id: string, @Request() req: any) {
    return this.labSuppliesService.getReagent(id, req.user?.tenantId);
  }

  @Put('reagents/:id')
  @ApiOperation({ summary: 'Update reagent' })
  async updateReagent(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.updateReagent(id, data, req.user?.tenantId);
  }

  // ==================== REAGENT LOTS ====================

  @Post('reagents/:reagentId/lots')
  @ApiOperation({ summary: 'Receive a new reagent lot' })
  async receiveLot(@Param('reagentId') reagentId: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.receiveLot({ ...data, reagentId }, req.user?.tenantId);
  }

  @Post('lots/:lotId/open')
  @ApiOperation({ summary: 'Open a reagent lot' })
  async openLot(@Param('lotId') lotId: string, @Request() req: any) {
    return this.labSuppliesService.openLot(lotId, req.user?.tenantId);
  }

  @Post('lots/:lotId/consume')
  @ApiOperation({ summary: 'Record reagent consumption' })
  async recordConsumption(@Param('lotId') lotId: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.recordConsumption({ ...data, lotId }, req.user?.tenantId);
  }

  // ==================== EQUIPMENT ====================

  @Post('equipment')
  @ApiOperation({ summary: 'Create lab equipment' })
  async createEquipment(@Body() data: any, @Request() req: any) {
    return this.labSuppliesService.createEquipment(data, req.user?.tenantId);
  }

  @Get('equipment')
  @ApiOperation({ summary: 'List lab equipment' })
  async listEquipment(
    @Query('facilityId') facilityId: string,
    @Query('category') category: string | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.listEquipment(facilityId, category, req.user?.tenantId);
  }

  @Get('equipment/calibration-due')
  @ApiOperation({ summary: 'Get equipment due for calibration' })
  async getCalibrationDue(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getEquipmentDueForCalibration(facilityId, daysAhead, req.user?.tenantId);
  }

  @Get('equipment/:id')
  @ApiOperation({ summary: 'Get equipment by ID' })
  async getEquipment(@Param('id') id: string, @Request() req: any) {
    return this.labSuppliesService.getEquipment(id, req.user?.tenantId);
  }

  @Put('equipment/:id')
  @ApiOperation({ summary: 'Update equipment' })
  async updateEquipment(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.updateEquipment(id, data, req.user?.tenantId);
  }

  @Post('equipment/:id/calibration')
  @ApiOperation({ summary: 'Record equipment calibration' })
  async recordCalibration(@Param('id') equipmentId: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.recordCalibration({ ...data, equipmentId }, req.user?.tenantId);
  }

  @Post('equipment/:id/maintenance')
  @ApiOperation({ summary: 'Record equipment maintenance' })
  async recordMaintenance(@Param('id') equipmentId: string, @Body() data: any, @Request() req: any) {
    return this.labSuppliesService.recordEquipmentMaintenance({ ...data, equipmentId }, req.user?.tenantId);
  }

  // ==================== QC MATERIALS ====================

  @Post('qc-materials')
  @ApiOperation({ summary: 'Create QC material' })
  async createQCMaterial(@Body() data: any, @Request() req: any) {
    return this.labSuppliesService.createQCMaterial(data, req.user?.tenantId);
  }

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

  @Post('qc-results')
  @ApiOperation({ summary: 'Record QC result' })
  async recordQCResult(@Body() data: any, @Request() req: any) {
    return this.labSuppliesService.recordQCResult(data, req.user?.tenantId);
  }

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

  @Get('qc-results/levey-jennings/:materialId')
  @ApiOperation({ summary: 'Get Levey-Jennings chart data' })
  async getLeveyJenningsData(
    @Param('materialId') materialId: string,
    @Query('months') months: number | undefined,
    @Request() req: any,
  ) {
    return this.labSuppliesService.getLeveyJenningsData(materialId, months, req.user?.tenantId);
  }

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
