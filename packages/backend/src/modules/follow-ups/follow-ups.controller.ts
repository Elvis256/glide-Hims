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
    return this.followUpsService.create(dto, req.user.sub, facilityId);
  }

  @Get()
  @AuthWithPermissions('followups.read')
  async findAll(@Query() filter: FollowUpFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.findAll(filter, facilityId);
  }

  @Get('today')
  @AuthWithPermissions('followups.read')
  async getTodaysAppointments(@Query('departmentId') departmentId: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.getTodaysAppointments(facilityId, departmentId);
  }

  @Get('stats')
  @AuthWithPermissions('followups.read')
  async getStats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.followUpsService.getStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
    );
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('followups.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.followUpsService.findByPatient(patientId);
  }

  @Get('patient/:patientId/upcoming')
  @AuthWithPermissions('followups.read')
  async getUpcoming(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.followUpsService.getUpcoming(patientId);
  }

  @Get(':id')
  @AuthWithPermissions('followups.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.followUpsService.findOne(id);
  }

  @Post(':id/confirm')
  @AuthWithPermissions('followups.update')
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.followUpsService.confirm(id);
  }

  @Post(':id/check-in')
  @AuthWithPermissions('followups.update')
  async checkIn(@Param('id', ParseUUIDPipe) id: string) {
    return this.followUpsService.checkIn(id);
  }

  @Post(':id/complete')
  @AuthWithPermissions('followups.update')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteFollowUpDto,
    @Request() req: any,
  ) {
    return this.followUpsService.complete(id, dto, req.user.sub);
  }

  @Post(':id/reschedule')
  @AuthWithPermissions('followups.update')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleFollowUpDto,
    @Request() req: any,
  ) {
    return this.followUpsService.reschedule(id, dto, req.user.sub);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('followups.delete')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelFollowUpDto,
  ) {
    return this.followUpsService.cancel(id, dto);
  }

  @Post(':id/mark-missed')
  @AuthWithPermissions('followups.update')
  async markMissed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.followUpsService.markMissed(id, reason);
  }

  @Post('send-reminders')
  @AuthWithPermissions('followups.create')
  async sendReminders() {
    const count = await this.followUpsService.sendReminders();
    return { message: `Sent ${count} reminders` };
  }
}
