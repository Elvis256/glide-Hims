import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RadiologyService } from './radiology.service';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CreateModalityDto,
  CreateImagingOrderDto,
  ScheduleImagingDto,
  PerformImagingDto,
  CreateImagingResultDto,
} from './dto/radiology.dto';
import { ModalityType } from '../../database/entities/imaging-modality.entity';
import { ImagingOrderStatus, ImagingPriority } from '../../database/entities/imaging-order.entity';

@ApiTags('Radiology')
@ApiBearerAuth()
@Controller('radiology')
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}

  // ============ DASHBOARD ============
  @Get('dashboard')
  @Auth()
  @ApiOperation({ summary: 'Get radiology dashboard' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.radiologyService.getDashboard(facilityId);
  }

  // ============ MODALITIES ============
  @Post('modalities')
  @Auth('radiology.modalities.create')
  @ApiOperation({ summary: 'Create modality' })
  async createModality(@Body() dto: CreateModalityDto) {
    return this.radiologyService.createModality(dto);
  }

  @Get('modalities')
  @Auth('radiology.modalities.read')
  @ApiOperation({ summary: 'Get modalities' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: false, enum: ModalityType })
  @ApiQuery({ name: 'active', required: false })
  async getModalities(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: ModalityType,
    @Query('active') active?: boolean,
  ) {
    return this.radiologyService.getModalities(facilityId, { type, active });
  }

  // ============ ORDERS ============
  @Post('orders')
  @Auth('radiology.orders.create')
  @ApiOperation({ summary: 'Create imaging order' })
  async createOrder(@Body() dto: CreateImagingOrderDto, @Request() req: any) {
    return this.radiologyService.createOrder(dto, req.user.id);
  }

  @Get('orders')
  @Auth('radiology.orders.read')
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
  ) {
    return this.radiologyService.getOrders(facilityId, { status, modalityId, patientId, priority, date });
  }

  @Get('worklist')
  @Auth('radiology.orders.read')
  @ApiOperation({ summary: 'Get radiology worklist' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getWorklist(@Query('facilityId') facilityId: string) {
    return this.radiologyService.getWorklist(facilityId);
  }

  @Get('orders/:id')
  @Auth('radiology.orders.read')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@Param('id') id: string) {
    return this.radiologyService.getOrder(id);
  }

  @Patch('orders/:id/schedule')
  @Auth('radiology.orders.update')
  @ApiOperation({ summary: 'Schedule imaging' })
  async scheduleOrder(@Param('id') id: string, @Body() dto: ScheduleImagingDto) {
    return this.radiologyService.scheduleOrder(id, dto);
  }

  @Post('orders/:id/start')
  @Auth('radiology.orders.update')
  @ApiOperation({ summary: 'Start imaging' })
  async startImaging(@Param('id') id: string, @Request() req: any) {
    return this.radiologyService.startImaging(id, req.user.id);
  }

  @Post('orders/:id/complete')
  @Auth('radiology.orders.update')
  @ApiOperation({ summary: 'Complete imaging' })
  async completeImaging(
    @Param('id') id: string,
    @Body() dto: PerformImagingDto,
    @Request() req: any,
  ) {
    return this.radiologyService.completeImaging(id, dto, req.user.id);
  }

  @Post('orders/:id/cancel')
  @Auth('radiology.orders.update')
  @ApiOperation({ summary: 'Cancel order' })
  async cancelOrder(@Param('id') id: string) {
    return this.radiologyService.cancelOrder(id);
  }

  // ============ RESULTS ============
  @Post('results')
  @Auth('radiology.results.create')
  @ApiOperation({ summary: 'Create imaging result/report' })
  async createResult(@Body() dto: CreateImagingResultDto, @Request() req: any) {
    return this.radiologyService.createResult(dto, req.user.id);
  }

  @Get('orders/:id/result')
  @Auth('radiology.results.read')
  @ApiOperation({ summary: 'Get result for order' })
  async getResult(@Param('id') id: string) {
    return this.radiologyService.getResult(id);
  }

  @Get('pending-reports')
  @Auth('radiology.results.read')
  @ApiOperation({ summary: 'Get orders pending reports' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getPendingReports(@Query('facilityId') facilityId: string) {
    return this.radiologyService.getResultsForReview(facilityId);
  }

  // ============ STATS ============
  @Get('stats/turnaround')
  @Auth('radiology.reports.read')
  @ApiOperation({ summary: 'Get turnaround time stats' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getTurnaroundStats(
    @Query('facilityId') facilityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.radiologyService.getTurnaroundStats(facilityId, startDate, endDate);
  }
}
