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
import { FollowUpsService } from './follow-ups.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CreateFollowUpDto, RescheduleFollowUpDto, CompleteFollowUpDto, CancelFollowUpDto, FollowUpFilterDto } from './dto/follow-up.dto';

@Controller('follow-ups')
@UseGuards(AuthGuard('jwt'))
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Post()
  @AuthWithPermissions('followups.create')
  async create(@Body() dto: CreateFollowUpDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.create(dto, req.user.sub, facilityId, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('followups.read')
  async findAll(@Query() filter: FollowUpFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.findAll(filter, facilityId, req.user?.tenantId);
  }

  @Get('today')
  @AuthWithPermissions('followups.read')
  async getTodaysAppointments(@Query('departmentId') departmentId: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.getTodaysAppointments(facilityId, departmentId, req.user?.tenantId);
  }

  @Get('stats')
  @AuthWithPermissions('followups.read')
  async getStats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.getStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
      req.user?.tenantId,
    );
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('followups.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.followUpsService.findByPatient(patientId, req.user?.tenantId);
  }

  @Get('patient/:patientId/upcoming')
  @AuthWithPermissions('followups.read')
  async getUpcoming(@Param('patientId', ParseUUIDPipe) patientId: string, @Request() req: any) {
    return this.followUpsService.getUpcoming(patientId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('followups.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.followUpsService.findOne(id, req.user?.tenantId);
  }

  @Post(':id/confirm')
  @AuthWithPermissions('followups.update')
  async confirm(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.followUpsService.confirm(id, req.user?.tenantId);
  }

  @Post(':id/check-in')
  @AuthWithPermissions('followups.update')
  async checkIn(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.followUpsService.checkIn(id, req.user?.tenantId);
  }

  @Post(':id/complete')
  @AuthWithPermissions('followups.update')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteFollowUpDto,
    @Request() req: any,
  ) {
    return this.followUpsService.complete(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/reschedule')
  @AuthWithPermissions('followups.update')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleFollowUpDto,
    @Request() req: any,
  ) {
    return this.followUpsService.reschedule(id, dto, req.user.sub, req.user?.tenantId);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('followups.delete')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelFollowUpDto,
    @Request() req: any,
  ) {
    return this.followUpsService.cancel(id, dto, req.user?.tenantId);
  }

  @Post(':id/mark-missed')
  @AuthWithPermissions('followups.update')
  async markMissed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.followUpsService.markMissed(id, reason, req.user?.tenantId);
  }

  @Post('send-reminders')
  @AuthWithPermissions('followups.create')
  async sendReminders(@Request() req: any) {
    const count = await this.followUpsService.sendReminders();
    return { message: `Sent ${count} reminders` };
  }
}
