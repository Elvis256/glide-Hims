import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { NotificationsService } from './notifications.service';
import { 
  CreateNotificationConfigDto, 
  SendReminderDto, 
  ScheduleReminderDto,
  TestNotificationDto,
  SendBulkNotificationDto,
} from './dto/notification.dto';
import { NotificationType } from '../../database/entities/notification-config.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('config')
  @AuthWithPermissions('notifications.read')
  @ApiOperation({ summary: 'Get notification configuration' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType })
  async getConfig(
    @Query('facilityId') facilityId: string,
    @Query('type') type?: NotificationType,
    @Request() req?: any,
  ) {
    return this.notificationsService.getConfig(facilityId, type, req?.user?.tenantId);
  }

  @Post('config')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Create or update notification configuration' })
  async createConfig(@Body() dto: CreateNotificationConfigDto, @Request() req: any) {
    return this.notificationsService.createOrUpdateConfig(dto, req.user?.tenantId);
  }

  @Post('config/test')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Test notification configuration' })
  async testConfig(@Body() dto: TestNotificationDto, @Request() req: any) {
    return this.notificationsService.testConfiguration(dto, req.user?.tenantId);
  }

  @Post('send')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send immediate reminder to patient' })
  async sendReminder(
    @Body() dto: SendReminderDto,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.notificationsService.sendImmediateReminder(facilityId, dto, user?.id, req.user?.tenantId);
  }

  @Post('schedule')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Schedule a reminder for later' })
  async scheduleReminder(
    @Body() dto: ScheduleReminderDto,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.notificationsService.scheduleReminder(facilityId, dto, user?.id, req.user?.tenantId);
  }

  @Get('history')
  @AuthWithPermissions('notifications.read')
  @ApiOperation({ summary: 'Get reminder history' })
  @ApiQuery({ name: 'facilityId', required: true })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getHistory(
    @Query('facilityId') facilityId: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.notificationsService.getReminderHistory(facilityId, patientId, limit, req?.user?.tenantId);
  }

  @Put(':id/cancel')
  @AuthWithPermissions('notifications.update')
  @ApiOperation({ summary: 'Cancel a scheduled reminder' })
  async cancelReminder(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.cancelReminder(id, req.user?.tenantId);
  }

  @Post('process-pending')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Process all pending reminders (admin only)' })
  async processPending(@Request() req: any) {
    const count = await this.notificationsService.processPendingReminders(req.user?.tenantId);
    return { processed: count };
  }

  // Template endpoints
  @Get('templates')
  @AuthWithPermissions('notifications.read')
  @ApiOperation({ summary: 'Get message templates' })
  @ApiQuery({ name: 'facilityId', required: true })
  async getTemplates(@Query('facilityId') facilityId: string) {
    return this.notificationsService.getTemplates(facilityId);
  }

  @Post('templates')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Create a message template' })
  async createTemplate(@Body() dto: any) {
    return this.notificationsService.createTemplate(dto);
  }

  @Put('templates/:id')
  @AuthWithPermissions('notifications.update')
  @ApiOperation({ summary: 'Update a message template' })
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @AuthWithPermissions('notifications.delete')
  @ApiOperation({ summary: 'Delete a message template' })
  async deleteTemplate(@Param('id') id: string) {
    return this.notificationsService.deleteTemplate(id);
  }

  // Bulk messaging
  @Post('bulk')
  @AuthWithPermissions('notifications.create')
  @ApiOperation({ summary: 'Send bulk SMS/WhatsApp/Email to multiple patients' })
  async sendBulk(
    @Body() dto: SendBulkNotificationDto,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.notificationsService.sendBulkMessages(dto, user?.id, req.user?.tenantId);
  }
}
