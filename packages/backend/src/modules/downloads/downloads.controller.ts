import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { DownloadsService } from './downloads.service';
import { CreateInstallerDto, UpdateInstallerDto } from './installer.dto';
import { meetsTier } from '../../common/constants/license-tiers.constants';

@ApiTags('Downloads')
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  @Get()
  @ApiOperation({ summary: 'List installers visible to the caller' })
  async list(@Req() req: any, @Query('channel') channel?: string) {
    if (req.user?.isSystemAdmin) return this.svc.listAll();
    const items = await this.svc.listPublished(channel);
    const tier = await this.svc.tierForTenant(req.user?.tenantId);
    // filter out installers gated above the caller's tier and annotate
    return items.filter((i) => meetsTier(tier, i.minLicenseTier));
  }

  @Get('audit')
  @ApiOperation({ summary: 'Recent download audit log (system admin only)' })
  async audit(@Req() req: any, @Query('installerId') installerId?: string) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.svc.listLogs(installerId, 200);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Stream the installer binary (auth required)' })
  async download(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const installer = await this.svc.findOne(id);
    const userMeta = {
      installerId: installer.id,
      userId: req.user?.userId || req.user?.id || null,
      tenantId: req.user?.tenantId || null,
      username: req.user?.username || req.user?.email || null,
      ipAddress: (req.ip || req.connection?.remoteAddress || '').toString().slice(0, 60) || null,
      userAgent: (req.headers?.['user-agent'] || '').toString().slice(0, 500) || null,
    };

    if (!installer.isPublished && !req.user?.isSystemAdmin) {
      await this.svc.logDownload({ ...userMeta, success: false });
      throw new ForbiddenException('Installer is not published');
    }
    if (!req.user?.isSystemAdmin) {
      const tier = await this.svc.tierForTenant(req.user?.tenantId);
      try {
        await this.svc.assertTierAllowed(installer, tier);
      } catch (e) {
        await this.svc.logDownload({ ...userMeta, success: false });
        throw e;
      }
    }

    const filePath = this.svc.resolveFilePath(installer);
    if (!filePath) {
      await this.svc.logDownload({ ...userMeta, success: false });
      throw new NotFoundException(
        `Installer file "${installer.filename}" is not on this server. Place it at ${this.svc.storageDir()}.`,
      );
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${installer.filename}"`);
    res.setHeader('X-SHA256', installer.sha256);
    res.setHeader('Content-Length', String(stat.size));

    await this.svc.logDownload({ ...userMeta, bytesServed: stat.size, success: true });

    fs.createReadStream(filePath).pipe(res);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new installer (system admin only)' })
  async create(@Req() req: any, @Body() dto: CreateInstallerDto) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.svc.create(dto);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateInstallerDto) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
    return this.svc.remove(id);
  }
}
