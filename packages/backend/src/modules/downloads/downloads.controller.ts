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

@ApiTags('Downloads')
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly svc: DownloadsService) {}

  @Get()
  @ApiOperation({ summary: 'List installers visible to the caller' })
  async list(@Req() req: any, @Query('channel') channel?: string) {
    if (req.user?.isSystemAdmin) return this.svc.listAll();
    return this.svc.listPublished(channel);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Stream the installer binary (auth required)' })
  async download(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const installer = await this.svc.findOne(id);
    if (!installer.isPublished && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Installer is not published');
    }
    const filePath = this.svc.resolveFilePath(installer);
    if (!filePath) {
      throw new NotFoundException(
        `Installer file "${installer.filename}" is not available on this server. Place it at ${this.svc.storageDir()}.`,
      );
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${installer.filename}"`);
    res.setHeader('X-SHA256', installer.sha256);
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
