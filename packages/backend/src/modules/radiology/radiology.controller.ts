import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RadiologyService } from './radiology.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateModalityDto,
  CreateImagingOrderDto,
  ScheduleImagingDto,
  PerformImagingDto,
  CreateImagingResultDto,
} from './dto/radiology.dto';
import { ModalityType } from '../../database/entities/imaging-modality.entity';
import { ImagingOrderStatus, ImagingPriority } from '../../database/entities/imaging-order.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFacilityAccess } from '../auth/decorators/facility-access.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Radiology')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('diagnostics')
@RequireFacilityAccess()
@Controller('radiology')
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @AuthWithPermissions('radiology.read')
  @ApiOperation({ summary: 'Get radiology dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getDashboard(facilityId, req.user?.tenantId);
  }

  // ============ MODALITIES ============
  @Post('modalities')
  @AuthWithPermissions('radiology.modalities.create')
  @ApiOperation({ summary: 'Create modality' })
  async createModality(@Body() dto: CreateModalityDto, @Request() req: any) {
    return this.radiologyService.createModality(dto, req.user?.tenantId);
  }

  @Get('modalities')
  @AuthWithPermissions('radiology.modalities.read')
  @ApiOperation({ summary: 'Get modalities' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: false, enum: ModalityType })
  @ApiQuery({ name: 'active', required: false })
  async getModalities(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: ModalityType,
    @Query('active') active?: boolean,
    @Request() req?: any,
  ) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getModalities(facilityId, { type, active }, req?.user?.tenantId);
  }

  // ============ ORDERS ============
  @Post('orders')
  @AuthWithPermissions('radiology.orders.create')
  @ApiOperation({ summary: 'Create imaging order' })
  async createOrder(@Body() dto: CreateImagingOrderDto, @Request() req: any) {
    return this.radiologyService.createOrder(dto, req.user.id, req.user?.tenantId);
  }

  @Get('orders')
  @AuthWithPermissions('radiology.orders.read')
  @ApiOperation({ summary: 'Get imaging orders' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: ImagingOrderStatus })
  @ApiQuery({ name: 'modalityId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'priority', required: false, enum: ImagingPriority })
  @ApiQuery({ name: 'date', required: false })
  async getOrders(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: ImagingOrderStatus,
    @Query('modalityId') modalityId?: string,
    @Query('patientId') patientId?: string,
    @Query('priority') priority?: ImagingPriority,
    @Query('date') date?: string,
    @Request() req?: any,
  ) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getOrders(
      facilityId,
      { status, modalityId, patientId, priority, date },
      req?.user?.tenantId,
    );
  }

  @Get('worklist')
  @AuthWithPermissions('radiology.orders.read')
  @ApiOperation({ summary: 'Get radiology worklist' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getWorklist(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getWorklist(facilityId, req.user?.tenantId);
  }

  @Get('orders/:id')
  @AuthWithPermissions('radiology.orders.read')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string, @Request() req: any) {
    return this.radiologyService.getOrder(id, req.user?.tenantId);
  }

  @Patch('orders/:id/schedule')
  @AuthWithPermissions('radiology.orders.update')
  @ApiOperation({ summary: 'Schedule imaging' })
  async scheduleOrder(
    @Param('id') id: string,
    @Body() dto: ScheduleImagingDto,
    @Request() req: any,
  ) {
    return this.radiologyService.scheduleOrder(id, dto, req.user?.tenantId);
  }

  @Post('orders/:id/start')
  @AuthWithPermissions('radiology.orders.update')
  @ApiOperation({ summary: 'Start imaging' })
  async startImaging(@Param('id') id: string, @Request() req: any) {
    return this.radiologyService.startImaging(id, req.user.id, req.user?.tenantId);
  }

  @Post('orders/:id/complete')
  @AuthWithPermissions('radiology.orders.update')
  @ApiOperation({ summary: 'Complete imaging' })
  async completeImaging(
    @Param('id') id: string,
    @Body() dto: PerformImagingDto,
    @Request() req: any,
  ) {
    return this.radiologyService.completeImaging(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('orders/:id/cancel')
  @AuthWithPermissions('radiology.orders.update')
  @ApiOperation({ summary: 'Cancel order' })
  async cancelOrder(@Param('id') id: string, @Request() req: any) {
    return this.radiologyService.cancelOrder(id, req.user.id, req.user?.tenantId);
  }

  // ============ RESULTS ============
  @Post('results')
  @AuthWithPermissions('radiology.results.create')
  @ApiOperation({ summary: 'Create imaging result/report' })
  async createResult(@Body() dto: CreateImagingResultDto, @Request() req: any) {
    return this.radiologyService.createResult(dto, req.user.id, req.user?.tenantId);
  }

  @Get('orders/:id/result')
  @AuthWithPermissions('radiology.results.read')
  @ApiOperation({ summary: 'Get result for order' })
  async getResult(@Param('id') id: string, @Request() req: any) {
    return this.radiologyService.getResult(id, req.user?.tenantId);
  }

  @Get('pending-reports')
  @AuthWithPermissions('radiology.results.read')
  @ApiOperation({ summary: 'Get orders pending reports' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getPendingReports(@Query('facilityId') facilityId: string, @Request() req: any) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getResultsForReview(facilityId, req.user?.tenantId);
  }

  // ============ STATS ============
  @Get('stats/turnaround')
  @AuthWithPermissions('radiology.reports.read')
  @ApiOperation({ summary: 'Get turnaround time stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getTurnaroundStats(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req?: any,
  ) {
    if (!facilityId || !UUID_REGEX.test(facilityId)) {
      throw new BadRequestException('Valid facilityId UUID is required');
    }
    return this.radiologyService.getTurnaroundStats(
      facilityId,
      startDate,
      endDate,
      req?.user?.tenantId,
    );
  }
}
