import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  Res,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SkipTransform } from '../../common/interceptors/response-transform.interceptor';
import { BackupService } from './backup.service';

@ApiTags('backups')
@Controller('backups')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backupService: BackupService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Static routes MUST come before parameterized routes to avoid NestJS
  // matching 'schedules' or 'dr-drills' as the :id parameter.
  // ───────────────────────────────────────────────────────────────────────────

  // ── Backup Schedules ──────────────────────────────────────────────────────

  @Get('schedules')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'List backup schedules for tenant' })
  @ApiResponse({ status: 200, description: 'List of backup schedules' })
  async listSchedules(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.backupService.listSchedules(tenantId);
  }

  @Post('schedules')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Create a backup schedule' })
  @ApiResponse({ status: 201, description: 'Backup schedule created' })
  async createSchedule(@Body() dto: any, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.backupService.createSchedule(dto, tenantId);
  }

  @Patch('schedules/:id')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Update a backup schedule' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.backupService.updateSchedule(id, dto, tenantId);
  }

  @Delete('schedules/:id')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Delete a backup schedule' })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async deleteSchedule(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    await this.backupService.deleteSchedule(id, tenantId);
    return { message: 'Backup schedule deleted successfully' };
  }

  // ── DR Drills ─────────────────────────────────────────────────────────────

  @Get('dr-drills')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'List DR drills for tenant' })
  @ApiResponse({ status: 200, description: 'List of DR drills' })
  async listDrDrills(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.backupService.listDrDrills(tenantId);
  }

  @Post('dr-drills')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Create/schedule a DR drill' })
  @ApiResponse({ status: 201, description: 'DR drill created' })
  async createDrDrill(@Body() dto: any, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!dto.conductedBy) {
      dto.conductedBy = req.user?.id;
    }
    return this.backupService.createDrDrill(dto, tenantId);
  }

  @Patch('dr-drills/:id')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Update a DR drill result' })
  @ApiParam({ name: 'id', description: 'DR Drill ID' })
  @ApiResponse({ status: 200, description: 'DR drill updated' })
  @ApiResponse({ status: 404, description: 'DR drill not found' })
  async updateDrDrill(@Param('id') id: string, @Body() dto: any) {
    return this.backupService.updateDrDrill(id, dto);
  }

  // ── Core Backup Endpoints ─────────────────────────────────────────────────

  @Post()
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Trigger a new backup' })
  @ApiResponse({ status: 201, description: 'Backup created successfully' })
  async createBackup(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    this.logger.log(`Backup requested by user ${userId} for tenant ${tenantId}`);
    return this.backupService.createBackup(tenantId, userId);
  }

  @Get()
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'List backups for tenant' })
  @ApiResponse({ status: 200, description: 'List of backups' })
  async listBackups(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    return this.backupService.listBackups(tenantId);
  }

  @Get(':id/download')
  @AuthWithPermissions('admin.backup')
  @SkipTransform()
  @ApiOperation({ summary: 'Download a backup file' })
  @ApiParam({ name: 'id', description: 'Backup ID' })
  @ApiResponse({ status: 200, description: 'Backup file stream' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async downloadBackup(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const tenantId = req.user?.tenantId;
    const backup = await this.backupService.downloadBackup(id, tenantId);

    if (!fs.existsSync(backup.filePath)) {
      throw new NotFoundException('Backup file not found on disk');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    const stream = fs.createReadStream(backup.filePath);
    stream.pipe(res);
  }

  @Post(':id/restore')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Restore data from a backup' })
  @ApiParam({ name: 'id', description: 'Backup ID to restore from' })
  @ApiResponse({ status: 200, description: 'Restore result' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async restoreFromBackup(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    this.logger.log(`Restore requested for backup ${id} by user ${userId}`);
    return this.backupService.restoreBackup(id, tenantId, userId);
  }

  @Delete(':id')
  @AuthWithPermissions('admin.backup')
  @ApiOperation({ summary: 'Delete a backup' })
  @ApiParam({ name: 'id', description: 'Backup ID' })
  @ApiResponse({ status: 200, description: 'Backup deleted' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  async deleteBackup(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    this.logger.log(`Deleting backup ${id} for tenant ${tenantId}`);
    await this.backupService.deleteBackup(id, tenantId);
    return { message: 'Backup deleted successfully' };
  }
}
