import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { 
  CreateNotificationConfigDto, 
  SendReminderDto, 
  ScheduleReminderDto,
  TestNotificationDto 
} from './dto/notification.dto';
import { NotificationType } from '../../database/entities/notification-config.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get notification configuration' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  async getConfig(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: NotificationType,
  ) {
    return this.notificationsService.getConfig(facilityId, type);
  }

  @Post('config')
  @ApiOperation({ summary: 'Create or update notification configuration' })
  async createConfig(@Body() dto: CreateNotificationConfigDto) {
    return this.notificationsService.createOrUpdateConfig(dto);
  }

  @Post('config/test')
  @ApiOperation({ summary: 'Test notification configuration' })
  async testConfig(@Body() dto: TestNotificationDto) {
    return this.notificationsService.testConfiguration(dto);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send immediate reminder to patient' })
  async sendReminder(
    @Body() dto: SendReminderDto,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.sendImmediateReminder(facilityId, dto, user?.id);
  }

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule a reminder for later' })
  async scheduleReminder(
    @Body() dto: ScheduleReminderDto,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.scheduleReminder(facilityId, dto, user?.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get reminder history' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getHistory(
    @Query('facilityId') facilityId: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getReminderHistory(facilityId, patientId, limit);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled reminder' })
  async cancelReminder(@Param('id') id: string) {
    return this.notificationsService.cancelReminder(id);
  }

  @Post('process-pending')
  @ApiOperation({ summary: 'Process all pending reminders (admin only)' })
  async processPending() {
    const count = await this.notificationsService.processPendingReminders();
    return { processed: count };
  }

  // Template endpoints
  @Get('templates')
  @ApiOperation({ summary: 'Get message templates' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getTemplates(@Query('facilityId') facilityId: string) {
    return this.notificationsService.getTemplates(facilityId);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a message template' })
  async createTemplate(@Body() dto: any) {
    return this.notificationsService.createTemplate(dto);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update a message template' })
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a message template' })
  async deleteTemplate(@Param('id') id: string) {
    return this.notificationsService.deleteTemplate(id);
  }

  // Bulk messaging
  @Post('bulk')
  @ApiOperation({ summary: 'Send bulk SMS/WhatsApp/Email to multiple patients' })
  async sendBulk(
    @Body() dto: { facilityId: string; patientIds: string[]; channel: string; subject?: string; message: string; type: string },
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.sendBulkMessages(dto, user?.id);
  }
}
