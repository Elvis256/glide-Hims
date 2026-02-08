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
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { QueueManagementService } from './queue-management.service';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, QueueFilterDto, CreateQueueDisplayDto } from './dto/queue.dto';
import { ServicePoint } from '../../database/entities/queue.entity';

@Controller('queue')
@UseGuards(AuthGuard('jwt'))
export class QueueManagementController {
  constructor(private readonly queueService: QueueManagementService) {}

  @Post()
  @AuthWithPermissions('queue.create')
  async addToQueue(@Body() dto: CreateQueueDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.addToQueue(dto, req.user.sub, facilityId);
  }

  @Get()
  @AuthWithPermissions('queue.read')
  async getQueue(@Query() filter: QueueFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getQueue(filter, facilityId);
  }

  @Get('waiting/:servicePoint')
  @AuthWithPermissions('queue.read')
  async getWaitingQueue(@Param('servicePoint') servicePoint: ServicePoint, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getWaitingQueue(servicePoint, facilityId);
  }

  @Get('stats')
  @AuthWithPermissions('queue.read')
  async getStats(@Query('servicePoint') servicePoint: ServicePoint, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getQueueStats(facilityId, servicePoint);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('queue.read')
  async getPatientQueueStatus(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getPatientQueueStatus(patientId, facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('queue.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.findOne(id);
  }

  @Post('call-next')
  @AuthWithPermissions('queue.update')
  async callNext(@Body() dto: CallNextDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.callNext(dto, req.user.sub, facilityId);
  }

  @Post(':id/call')
  @AuthWithPermissions('queue.update')
  async callPatient(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.callPatient(id, req.user.sub, facilityId);
  }

  @Post(':id/recall')
  @AuthWithPermissions('queue.update')
  async recallPatient(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.recallPatient(id);
  }

  @Post(':id/start-service')
  @AuthWithPermissions('queue.update')
  async startService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.startService(id, req.user.sub);
  }

  @Post(':id/complete')
  @AuthWithPermissions('queue.update')
  async completeService(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.completeService(id);
  }

  @Post(':id/transfer')
  @AuthWithPermissions('queue.update')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferQueueDto,
    @Request() req: any,
  ) {
    return this.queueService.transferToNextService(id, dto, req.user.sub);
  }

  @Post(':id/skip')
  @AuthWithPermissions('queue.update')
  async skipPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipQueueDto,
  ) {
    return this.queueService.skipPatient(id, dto);
  }

  @Post(':id/no-show')
  @AuthWithPermissions('queue.update')
  async markNoShow(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.markNoShow(id);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('queue.delete')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.queueService.cancelFromQueue(id, reason);
  }

  @Post(':id/requeue')
  @AuthWithPermissions('queue.update')
  async requeue(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.requeuePatient(id);
  }

  // Display endpoints
  @Post('displays')
  @AuthWithPermissions('queue.create')
  async createDisplay(@Body() dto: CreateQueueDisplayDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.createDisplay(dto, facilityId);
  }

  @Get('displays')
  @AuthWithPermissions('queue.read')
  async getDisplays(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.queueService.getDisplays(facilityId);
  }

  @Get('displays/:displayCode/queue')
  @AuthWithPermissions('queue.read')
  async getDisplayQueue(@Param('displayCode') displayCode: string) {
    return this.queueService.getDisplayQueue(displayCode);
  }
}
