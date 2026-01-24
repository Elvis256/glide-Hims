import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QueueManagementService } from './queue-management.service';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, QueueFilterDto, CreateQueueDisplayDto } from './dto/queue.dto';
import { ServicePoint } from '../../database/entities/queue.entity';

@Controller('queue')
@UseGuards(AuthGuard('jwt'))
export class QueueManagementController {
  constructor(private readonly queueService: QueueManagementService) {}

  @Post()
  async addToQueue(@Body() dto: CreateQueueDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.addToQueue(dto, req.user.sub, facilityId);
  }

  @Get()
  async getQueue(@Query() filter: QueueFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getQueue(filter, facilityId);
  }

  @Get('waiting/:servicePoint')
  async getWaitingQueue(@Param('servicePoint') servicePoint: ServicePoint, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getWaitingQueue(servicePoint, facilityId);
  }

  @Get('stats')
  async getStats(@Query('servicePoint') servicePoint: ServicePoint, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getQueueStats(facilityId, servicePoint);
  }

  @Get('patient/:patientId')
  async getPatientQueueStatus(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getPatientQueueStatus(patientId, facilityId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.findOne(id);
  }

  @Post('call-next')
  async callNext(@Body() dto: CallNextDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.callNext(dto, req.user.sub, facilityId);
  }

  @Post(':id/recall')
  async recallPatient(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.recallPatient(id);
  }

  @Post(':id/start-service')
  async startService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.startService(id, req.user.sub);
  }

  @Post(':id/complete')
  async completeService(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.completeService(id);
  }

  @Post(':id/transfer')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferQueueDto,
    @Request() req: any,
  ) {
    return this.queueService.transferToNextService(id, dto, req.user.sub);
  }

  @Post(':id/skip')
  async skipPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipQueueDto,
  ) {
    return this.queueService.skipPatient(id, dto);
  }

  @Post(':id/no-show')
  async markNoShow(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.markNoShow(id);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.queueService.cancelFromQueue(id, reason);
  }

  @Post(':id/requeue')
  async requeue(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.requeuePatient(id);
  }

  // Display endpoints
  @Post('displays')
  async createDisplay(@Body() dto: CreateQueueDisplayDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.createDisplay(dto, facilityId);
  }

  @Get('displays')
  async getDisplays(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getDisplays(facilityId);
  }

  @Get('displays/:displayCode/queue')
  async getDisplayQueue(@Param('displayCode') displayCode: string) {
    return this.queueService.getDisplayQueue(displayCode);
  }
}
