import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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
