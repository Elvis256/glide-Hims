import {
  Controller, Get, Post, Body, Param, Query, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { LabelService } from './label.service';
import { TemperatureService } from './temperature.service';
import { PharmacyDashboardService } from './pharmacy-dashboard.service';
import { CreatePharmacySaleDto, CompleteSaleDto, AllocateFEFODto, ReceiveBatchDto, QuarantineItemDto, ProcessExpiredItemDto } from './pharmacy.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SaleStatus } from '../../database/entities/pharmacy-sale.entity';

@ApiTags('Pharmacy POS')
@ApiBearerAuth()
@Controller('pharmacy')
export class PharmacyController {
  constructor(
    private readonly service: PharmacyService,
    private readonly labelService: LabelService,
    private readonly temperatureService: TemperatureService,
    private readonly dashboardService: PharmacyDashboardService,
  ) {}

  @Get('dashboard/kpis')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get pharmacy dashboard KPIs — queue, stock, revenue, dispensing' })
  getDashboardKPIs(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.dashboardService.getDashboardKPIs(req.user?.tenantId, facilityId);
  }

  @Get('queue/stats')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get pharmacy queue statistics for dashboard' })
  getQueueStats(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.getQueueStats(facilityId, req.user?.tenantId);
  }

  @Post('sales')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create pharmacy sale (walk-in or prescription)' })
  createSale(@Body() dto: CreatePharmacySaleDto, @Request() req: any) {
    return this.service.createSale(dto, req.user.id, req.user?.tenantId);
  }

  @Get('sales')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List pharmacy sales' })
  findAllSales(
    @Query('storeId') storeId?: string,
    @Query('status') status?: SaleStatus,
    @Query('date') date?: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.service.findAllSales(storeId, status, date, limit, req?.user?.tenantId);
  }

  @Get('sales/:id')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get sale by ID' })
  findSale(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findSale(id, req.user?.tenantId);
  }

  @Post('sales/:id/complete')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Complete sale with payment' })
  completeSale(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteSaleDto, @Request() req: any) {
    return this.service.completeSale(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('sales/:id/cancel')
  @AuthWithPermissions('pharmacy.delete')
  @ApiOperation({ summary: 'Cancel pending sale' })
  cancelSale(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.cancelSale(id, req.user?.tenantId);
  }

  @Get('summary/daily')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get daily sales summary' })
  getDailySummary(
    @Query('storeId') storeId?: string,
    @Query('date') date?: string,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.service.getDailySummary(storeId, date, facilityId, req?.user?.tenantId);
  }

  @Get('analytics/profit')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get profit analytics with revenue, COGS, margins, and per-item breakdown' })
  getProfitAnalytics(
    @Query('storeId') storeId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    return this.service.getProfitAnalytics({ storeId, facilityId, dateFrom, dateTo, tenantId: req?.user?.tenantId });
  }

  // ── Batch Stock (FEFO) Endpoints ──────────────────────────────────────

  @Get('batch-stock/:itemId')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get batch-level stock breakdown for an item (FEFO ordered)' })
  getBatchStock(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req: any,
  ) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.getBatchStock(itemId, facilityId, req.user?.tenantId);
  }

  @Post('batch-stock/allocate')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'FEFO allocation preview — allocate stock from earliest-expiry batches' })
  allocateFEFO(@Body() dto: AllocateFEFODto, @Request() req: any) {
    return this.service.allocateFEFO(dto, req.user?.tenantId);
  }

  @Post('batch-stock/receive')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Record incoming batch stock' })
  receiveBatch(@Body() dto: ReceiveBatchDto, @Request() req: any) {
    return this.service.receiveBatch(dto, req.user?.tenantId);
  }

  // ── Low-Stock Reorder Alerts ──────────────────────────────────────────

  @Get('alerts/low-stock')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get low-stock items where quantity is at or below reorder level' })
  getLowStockAlerts(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.checkLowStock(req.user?.tenantId, facilityId);
  }

  // ── Expiry Workflow Endpoints ─────────────────────────────────────────

  @Get('expiry/alerts')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get items expiring within a given threshold (default 90 days)' })
  getExpiringItems(
    @Query('daysThreshold') daysThreshold?: number,
    @Request() req?: any,
  ) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.checkExpiringItems(req.user?.tenantId, facilityId, daysThreshold ? Number(daysThreshold) : 90);
  }

  @Post('expiry/quarantine')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Quarantine a near-expiry or expired item batch' })
  quarantineItem(@Body() dto: QuarantineItemDto, @Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.quarantineItem(dto.itemId, dto.batchNumber, req.user?.tenantId, facilityId, req.user.id, dto.notes);
  }

  @Post('expiry/process')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Process a quarantined item — dispose or return to supplier' })
  processExpiredItem(@Body() dto: ProcessExpiredItemDto, @Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.processExpiredItem(dto.itemId, dto.action, req.user?.tenantId, facilityId, req.user.id, dto.batchNumber, dto.notes);
  }

  @Get('expiry/report')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get expiry management report — near-expiry, quarantined, disposed, returned summary' })
  getExpiryReport(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.service.getExpiryReport(req.user?.tenantId, facilityId);
  }

  // ── Drug Label Endpoints ──────────────────────────────────────────────

  @Get('labels/generate/:prescriptionItemId')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Generate a drug label for a prescription item' })
  generateLabel(
    @Param('prescriptionItemId', ParseUUIDPipe) prescriptionItemId: string,
    @Query('language') language: string,
    @Request() req: any,
  ) {
    return this.labelService.generateLabel(prescriptionItemId, language || 'en', req.user?.tenantId);
  }

  @Get('labels/templates')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List drug label templates' })
  getTemplates(
    @Query('language') language?: string,
    @Request() req?: any,
  ) {
    return this.labelService.getTemplates(req?.user?.tenantId, language);
  }

  @Post('labels/templates')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create a drug label template' })
  createTemplate(@Body() body: any, @Request() req: any) {
    return this.labelService.createTemplate(body, req.user?.tenantId);
  }

  @Get('labels/translations')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List drug translations' })
  getTranslations(
    @Query('language') language?: string,
    @Request() req?: any,
  ) {
    return this.labelService.getTranslations(req?.user?.tenantId, language);
  }

  @Post('labels/translations')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Add a drug translation' })
  createTranslation(@Body() body: any, @Request() req: any) {
    return this.labelService.createTranslation(body, req.user?.tenantId);
  }

  // ── Temperature Monitoring Endpoints ──────────────────────────────────

  @Post('temperature/readings')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Record a temperature reading (IoT or manual entry)' })
  recordReading(@Body() body: any, @Request() req: any) {
    const facilityId = body.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    return this.temperatureService.recordReading(
      body.sensorId, body.temperature, body.humidity ?? null, req.user?.tenantId, facilityId,
    );
  }

  @Get('temperature/readings/:sensorId')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get temperature readings history for a sensor' })
  getSensorReadings(
    @Param('sensorId') sensorId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Request() req?: any,
  ) {
    return this.temperatureService.getSensorReadings(sensorId, dateFrom, dateTo, req?.user?.tenantId);
  }

  @Get('temperature/alerts')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get active (unacknowledged) temperature alerts' })
  getTemperatureAlerts(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.temperatureService.getActiveAlerts(req.user?.tenantId, facilityId);
  }

  @Post('temperature/alerts/:id/acknowledge')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Acknowledge a temperature alert' })
  acknowledgeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.temperatureService.acknowledgeAlert(id, req.user?.id, req.user?.tenantId);
  }

  @Get('temperature/sensors')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List temperature sensors' })
  getSensors(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.temperatureService.getSensors(req.user?.tenantId, facilityId);
  }

  @Post('temperature/sensors')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Register a new temperature sensor' })
  createSensor(@Body() body: any, @Request() req: any) {
    return this.temperatureService.createSensor(body, req.user?.tenantId);
  }
}
