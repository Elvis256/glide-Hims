import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RxTemplateService, CreateTemplateDto, UpdateTemplateDto } from './rx-template.service';
import { RxNotificationService } from './rx-notification.service';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Prescription Templates & Notifications')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pharmacy')
@Controller('prescriptions')
export class RxTemplateNotificationController {
  constructor(
    private readonly templateService: RxTemplateService,
    private readonly notificationService: RxNotificationService,
  ) {}

  // ─── Template Endpoints ───

  @Get('templates')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'List prescription templates' })
  getTemplates(
    @Query('department') department: string,
    @Query('condition') condition: string,
    @Query('scope') scope: string,
    @Query('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.templateService.getTemplates(
      req.user?.tenantId,
      facilityId,
      req.user?.id,
      department,
      condition,
      scope,
    );
  }

  @Get('templates/popular')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get popular prescription templates' })
  getPopularTemplates(
    @Query('facilityId') facilityId: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    return this.templateService.getPopularTemplates(
      req.user?.tenantId,
      facilityId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('templates/:id')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get a prescription template' })
  getTemplate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.templateService.getTemplate(id, req.user?.tenantId);
  }

  @Post('templates')
  @AuthWithPermissions('prescriptions.create')
  @ApiOperation({ summary: 'Create a prescription template' })
  createTemplate(@Body() dto: CreateTemplateDto, @Request() req: any) {
    return this.templateService.createTemplate(dto, req.user?.id, req.user?.tenantId);
  }

  @Put('templates/:id')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Update a prescription template' })
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @Request() req: any,
  ) {
    return this.templateService.updateTemplate(id, dto, req.user?.id, req.user?.tenantId);
  }

  @Delete('templates/:id')
  @AuthWithPermissions('prescriptions.delete')
  @ApiOperation({ summary: 'Delete a prescription template' })
  deleteTemplate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.templateService.deleteTemplate(id, req.user?.id, req.user?.tenantId);
  }

  @Post('templates/:id/apply')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Apply a template (get items + increment usage)' })
  applyTemplate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.templateService.applyTemplate(id, req.user?.tenantId);
  }

  // ─── Notification Endpoints ───

  @Post(':id/notify/ready')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Send prescription ready SMS notification' })
  notifyReady(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.notificationService.notifyPrescriptionReady(id, req.user?.tenantId);
  }

  @Post(':id/notify/refill')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Send refill reminder SMS notification' })
  notifyRefill(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.notificationService.notifyRefillReminder(id, req.user?.tenantId);
  }

  @Get(':id/notifications')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get notification log for a prescription' })
  getNotificationLog(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.notificationService.getNotificationLog(id, req.user?.tenantId);
  }

  @Get('notifications/patient/:patientId')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'Get notification history for a patient' })
  getPatientNotifications(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any,
  ) {
    return this.notificationService.getPatientNotifications(patientId, req.user?.tenantId);
  }

  @Get('notifications/all')
  @AuthWithPermissions('prescriptions.read')
  @ApiOperation({ summary: 'List all notifications with filters' })
  getAllNotifications(
    @Query('notificationType') notificationType: string,
    @Query('status') status: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    return this.notificationService.getAllNotifications(req.user?.tenantId, {
      notificationType,
      status,
      dateFrom,
      dateTo,
    });
  }

  @Post('notifications/:notificationId/resend')
  @AuthWithPermissions('prescriptions.update')
  @ApiOperation({ summary: 'Resend a failed notification' })
  resendNotification(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Request() req: any,
  ) {
    return this.notificationService.resendNotification(notificationId, req.user?.tenantId);
  }
}
