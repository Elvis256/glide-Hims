import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { QueueManagementService } from './queue-management.service';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, HoldQueueDto, QueueFilterDto, CreateQueueDisplayDto, ServiceConfigDto } from './dto/queue.dto';

@Controller('queue')
@UseGuards(AuthGuard('jwt'))
export class QueueManagementController {
  constructor(private readonly queueService: QueueManagementService) {}

  @Post()
  @AuthWithPermissions('queue.create')
  async addToQueue(@Body() dto: CreateQueueDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    if (!facilityId) {
      throw new BadRequestException('Facility context is required. Please select a facility or re-login.');
    }
    return this.queueService.addToQueue(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('queue.read')
  async getQueue(@Query() filter: QueueFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getQueue(filter, facilityId, req.user?.tenantId);
  }

  @Get('waiting/:servicePoint')
  @AuthWithPermissions('queue.read')
  async getWaitingQueue(@Param('servicePoint') servicePoint: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getWaitingQueue(servicePoint as any, facilityId, req.user?.tenantId);
  }

  @Get('stats')
  @AuthWithPermissions('queue.read')
  async getStats(@Query('servicePoint') servicePoint: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getQueueStats(facilityId, servicePoint, req.user?.tenantId);
  }

  @Get('service-config')
  @AuthWithPermissions('queue.read')
  async getServiceConfig(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getServiceConfig(facilityId, req.user?.tenantId);
  }

  @Put('service-config')
  @AuthWithPermissions('queue.create')
  async upsertServiceConfig(@Body() dto: ServiceConfigDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.upsertServiceConfig(facilityId, dto, req.user?.tenantId);
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('queue.read')
  async getPatientQueueStatus(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getPatientQueueStatus(patientId, facilityId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('queue.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.findOne(id, req.user?.tenantId);
  }

  @Get(':id/audit-log')
  @AuthWithPermissions('queue.read')
  async getAuditLog(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.getQueueAuditLog(id, req.user?.tenantId);
  }

  @Post('call-next')
  @AuthWithPermissions('queue.update')
  async callNext(@Body() dto: CallNextDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.callNext(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Post(':id/call')
  @AuthWithPermissions('queue.update')
  async callPatient(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.callPatient(id, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Post(':id/recall')
  @AuthWithPermissions('queue.update')
  async recallPatient(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.recallPatient(id, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/start-service')
  @AuthWithPermissions('queue.update')
  async startService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.startService(id, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/complete')
  @AuthWithPermissions('queue.update')
  async completeService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.completeService(id, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/transfer')
  @AuthWithPermissions('queue.update')
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferQueueDto,
    @Request() req: any,
  ) {
    return this.queueService.transferToNextService(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/skip')
  @AuthWithPermissions('queue.update')
  async skipPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipQueueDto,
    @Request() req: any,
  ) {
    return this.queueService.skipPatient(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/no-show')
  @AuthWithPermissions('queue.update')
  async markNoShow(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.markNoShow(id, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('queue.delete')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.queueService.cancelFromQueue(id, reason, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/requeue')
  @AuthWithPermissions('queue.update')
  async requeue(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.requeuePatient(id, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/triage-disposition')
  @AuthWithPermissions('queue.update')
  async triageDisposition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('disposition') disposition: string,
    @Request() req: any,
  ) {
    if (!disposition) {
      throw new BadRequestException('disposition is required');
    }
    return this.queueService.completeTriageWithDisposition(id, disposition, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/hold')
  @AuthWithPermissions('queue.update')
  async hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HoldQueueDto,
    @Request() req: any,
  ) {
    return this.queueService.holdQueue(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/unhold')
  @AuthWithPermissions('queue.update')
  async unhold(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.queueService.unholdQueue(id, req.user.sub, req.user?.tenantId);
  }

  // Display endpoints
  @Post('displays')
  @AuthWithPermissions('queue.create')
  async createDisplay(@Body() dto: CreateQueueDisplayDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.createDisplay(dto, facilityId, req.user?.tenantId);
  }

  @Get('displays')
  @AuthWithPermissions('queue.read')
  async getDisplays(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    return this.queueService.getDisplays(facilityId, req.user?.tenantId);
  }

  @Get('displays/:displayCode/queue')
  @AuthWithPermissions('queue.read')
  async getDisplayQueue(@Param('displayCode') displayCode: string, @Request() req: any) {
    return this.queueService.getDisplayQueue(displayCode, req.user?.tenantId);
  }
}
