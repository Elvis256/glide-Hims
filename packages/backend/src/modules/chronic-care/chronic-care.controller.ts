import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChronicCareService } from './chronic-care.service';
import { 
  RegisterChronicConditionDto, 
  UpdateChronicConditionDto, 
  ChronicPatientsQueryDto,
  SendBulkReminderDto 
} from './dto/chronic-care.dto';
import { ChronicStatus } from '../../database/entities/patient-chronic-condition.entity';

@ApiTags('Chronic Care')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chronic-care')
export class ChronicCareController {
  constructor(private readonly chronicCareService: ChronicCareService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get chronic care dashboard statistics' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getDashboard(@Query('facilityId') facilityId: string) {
    return this.chronicCareService.getDashboardStats(facilityId);
  }

  @Get('conditions')
  @ApiOperation({ summary: 'Get list of chronic conditions (diagnoses)' })
  async getConditionsList() {
    return this.chronicCareService.getChronicConditionsList();
  }

  @Get('patients')
  @ApiOperation({ summary: 'Get all chronic patients with contacts' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'diagnosisId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ChronicStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'overdueFollowUp', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPatients(
    @Query('facilityId') facilityId: string,
    @Query() query: ChronicPatientsQueryDto,
  ) {
    return this.chronicCareService.getChronicPatients(facilityId, query);
  }

  @Get('patients/:patientId/conditions')
  @ApiOperation({ summary: 'Get chronic conditions for a specific patient' })
  async getPatientConditions(@Param('patientId') patientId: string) {
    return this.chronicCareService.getPatientConditions(patientId);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get patients with overdue follow-ups' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async getOverdue(
    @Query('facilityId') facilityId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chronicCareService.getOverduePatients(facilityId, limit);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register patient with chronic condition' })
  @ApiQuery({ name: 'facilityId', required: true })
  async register(
    @Query('facilityId') facilityId: string,
    @Body() dto: RegisterChronicConditionDto,
    @CurrentUser() user: any,
  ) {
    return this.chronicCareService.registerCondition(facilityId, dto, user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update chronic condition' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateChronicConditionDto,
  ) {
    return this.chronicCareService.updateCondition(id, dto);
  }

  @Post(':id/record-visit')
  @ApiOperation({ summary: 'Record a visit and update next follow-up' })
  async recordVisit(
    @Param('id') id: string,
    @Body('nextFollowUpDate') nextFollowUpDate?: Date,
  ) {
    return this.chronicCareService.recordVisit(id, nextFollowUpDate);
  }

  @Post(':id/send-reminder')
  @ApiOperation({ summary: 'Send reminder to patient about follow-up' })
  @ApiQuery({ name: 'facilityId', required: true })
  async sendReminder(
    @Param('id') id: string,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: any,
  ) {
    return this.chronicCareService.sendReminder(facilityId, id, user?.id);
  }

  @Post('send-bulk-reminders')
  @ApiOperation({ summary: 'Send reminders to multiple patients' })
  @ApiQuery({ name: 'facilityId', required: true })
  async sendBulkReminders(
    @Query('facilityId') facilityId: string,
    @Body() dto: SendBulkReminderDto,
    @CurrentUser() user: any,
  ) {
    return this.chronicCareService.sendBulkReminders(facilityId, dto, user?.id);
  }

  @Post('schedule-reminders')
  @ApiOperation({ summary: 'Auto-schedule reminders for upcoming follow-ups' })
  @ApiQuery({ name: 'facilityId', required: true })
  async scheduleReminders(@Query('facilityId') facilityId: string) {
    const count = await this.chronicCareService.scheduleUpcomingReminders(facilityId);
    return { scheduled: count };
  }
}
