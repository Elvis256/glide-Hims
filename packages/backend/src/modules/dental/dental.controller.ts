import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DentalService } from './dental.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  UpdateToothRecordDto,
  CreateDentalProcedureDto,
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanItemStatusDto,
  UploadDentalImageDto,
  CreateLabOrderDto,
  UpdateLabOrderStatusDto,
  CreateOrthoCaseDto,
  UpdateOrthoCaseDto,
  RecordOrthoAdjustmentDto,
  CreatePerioChartDto,
} from './dental.dto';

@ApiTags('Dental')
@ApiBearerAuth()
@Controller('dental')
export class DentalController {
  constructor(private readonly dentalService: DentalService) {}

  // ============ CHARTING ============

  @Get('chart/:patientId')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get or create dental chart for a patient' })
  async getChart(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.getOrCreateChart(patientId, user.tenantId);
  }

  @Patch('chart/:chartId/tooth/:toothNumber')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Update a tooth record on a dental chart' })
  async updateTooth(
    @Param('chartId') chartId: string,
    @Param('toothNumber') toothNumber: string,
    @Body() dto: UpdateToothRecordDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.updateTooth(chartId, toothNumber, dto, user.tenantId);
  }

  // ============ PROCEDURES ============

  @Get('procedures')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'List dental procedures (CDT codes)' })
  @ApiQuery({ name: 'category', required: false })
  async listProcedures(
    @Query('category') category: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findAllProcedures(user.tenantId, category);
  }

  @Post('procedures')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Create a dental procedure' })
  async createProcedure(
    @Body() dto: CreateDentalProcedureDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.createProcedure(dto, user.tenantId);
  }

  // ============ TREATMENT PLANS ============

  @Post('treatment-plans')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Create a treatment plan with items' })
  async createTreatmentPlan(
    @Body() dto: CreateTreatmentPlanDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.createPlan(dto, user.tenantId, user.id);
  }

  @Get('treatment-plans/patient/:patientId')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get treatment plans for a patient' })
  async getPatientTreatmentPlans(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findPatientPlans(patientId, user.tenantId);
  }

  @Patch('treatment-plans/:id/accept')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Accept a treatment plan' })
  async acceptTreatmentPlan(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.acceptPlan(id, user.tenantId);
  }

  @Patch('treatment-plans/items/:itemId/status')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Update treatment plan item status' })
  async updatePlanItemStatus(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTreatmentPlanItemStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.updatePlanItemStatus(itemId, dto, user.tenantId);
  }

  // ============ IMAGES ============

  @Post('images')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Record dental image metadata' })
  async recordImage(
    @Body() dto: UploadDentalImageDto,
    @CurrentUser() user: any,
  ) {
    // filePath would normally come from a file upload handler; use a placeholder path
    const filePath = `dental-images/${dto.patientId}/${Date.now()}-${dto.fileName}`;
    return this.dentalService.recordImage(dto, filePath, user.tenantId, user.id);
  }

  @Get('images/patient/:patientId')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get dental images for a patient' })
  @ApiQuery({ name: 'toothNumber', required: false })
  async getPatientImages(
    @Param('patientId') patientId: string,
    @Query('toothNumber') toothNumber: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findPatientImages(patientId, user.tenantId, toothNumber);
  }

  @Delete('images/:id')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Delete a dental image' })
  async deleteImage(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    await this.dentalService.deleteImage(id, user.tenantId);
    return { deleted: true };
  }

  // ============ LAB ORDERS ============

  @Post('lab-orders')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Create a dental lab order' })
  async createLabOrder(
    @Body() dto: CreateLabOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.createLabOrder(dto, user.tenantId, user.id);
  }

  @Get('lab-orders')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'List dental lab orders' })
  @ApiQuery({ name: 'status', required: false })
  async listLabOrders(
    @Query('status') status: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findLabOrders(user.tenantId, status);
  }

  @Patch('lab-orders/:id/status')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Update lab order status' })
  async updateLabOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLabOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.updateLabOrderStatus(id, dto, user.tenantId);
  }

  @Get('lab-orders/stats')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get lab order statistics' })
  async getLabOrderStats(@CurrentUser() user: any) {
    return this.dentalService.getLabOrderStats(user.tenantId);
  }

  // ============ ORTHODONTICS ============

  @Post('ortho/cases')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Create an orthodontic case' })
  async createOrthoCase(
    @Body() dto: CreateOrthoCaseDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.createCase(dto, user.tenantId, user.id);
  }

  @Get('ortho/cases')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'List orthodontic cases' })
  @ApiQuery({ name: 'status', required: false })
  async listOrthoCases(
    @Query('status') status: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findCases(user.tenantId, status);
  }

  @Get('ortho/cases/:id')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get orthodontic case detail' })
  async getOrthoCase(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.getCase(id, user.tenantId);
  }

  @Post('ortho/cases/:id/adjustment')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Record an orthodontic adjustment' })
  async recordOrthoAdjustment(
    @Param('id') id: string,
    @Body() dto: RecordOrthoAdjustmentDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.recordAdjustment(id, dto, user.tenantId);
  }

  @Patch('ortho/cases/:id')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Update an orthodontic case' })
  async updateOrthoCase(
    @Param('id') id: string,
    @Body() dto: UpdateOrthoCaseDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.updateCase(id, dto, user.tenantId);
  }

  // ============ PERIODONTICS ============

  @Post('perio/charts')
  @AuthWithPermissions('dental.manage')
  @ApiOperation({ summary: 'Create a periodontal chart' })
  async createPerioChart(
    @Body() dto: CreatePerioChartDto,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.createPerioChart(dto, user.tenantId, user.id);
  }

  @Get('perio/charts/patient/:patientId')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get periodontal charts for a patient' })
  async getPatientPerioCharts(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.findPatientPerioCharts(patientId, user.tenantId);
  }

  @Get('perio/charts/:id')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Get a specific periodontal chart' })
  async getPerioChart(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.getPerioChart(id, user.tenantId);
  }

  @Get('perio/charts/patient/:patientId/compare')
  @AuthWithPermissions('dental.view')
  @ApiOperation({ summary: 'Compare last 2 periodontal charts' })
  async comparePerioCharts(
    @Param('patientId') patientId: string,
    @CurrentUser() user: any,
  ) {
    return this.dentalService.comparePerioCharts(patientId, user.tenantId);
  }
}
