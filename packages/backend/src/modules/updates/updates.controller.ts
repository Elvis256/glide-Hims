import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Res,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { UpdatesService } from './updates.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Updates')
@Controller('updates')
export class UpdatesController {
  constructor(private readonly updatesService: UpdatesService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
  }

  /**
   * Check for available updates (public endpoint for on-premise)
   */
  @Get('check')
  @Public()
  @ApiOperation({ summary: 'Check for available updates' })
  async checkForUpdates(@Query('version') version: string, @Query('license') license?: string) {
    return this.updatesService.checkForUpdates(version || '0.0.0');
  }

  /**
   * Get latest version info
   */
  @Get('latest')
  @Public()
  @ApiOperation({ summary: 'Get latest version information' })
  async getLatestVersion() {
    const version = await this.updatesService.getLatestVersion();
    if (!version) {
      return { message: 'No versions available' };
    }
    return version;
  }

  /**
   * Get all versions
   */
  @Get('versions')
  @Public()
  @ApiOperation({ summary: 'Get all versions' })
  async getAllVersions(@Query('limit') limit?: string) {
    return this.updatesService.getAllVersions(limit ? parseInt(limit, 10) : undefined);
  }

  /**
   * Get specific version
   */
  @Get('versions/:version')
  @Public()
  @ApiOperation({ summary: 'Get specific version' })
  async getVersion(@Param('version') version: string) {
    return this.updatesService.getVersion(version);
  }

  /**
   * Create new version (system admin only)
   */
  @Post('versions')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Create new version' })
  async createVersion(
    @Body()
    body: {
      version: string;
      versionCode: string;
      releaseNotes?: string;
      minUpgradeFrom?: string;
      isMandatory?: boolean;
      isLatest?: boolean;
      downloadUrl?: string;
      checksum?: string;
      fileSize?: number;
    },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    return this.updatesService.createVersion(body, req?.user?.id);
  }

  /**
   * Set version as latest (system admin only)
   */
  @Put('versions/:version/set-latest')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Set version as latest' })
  async setLatestVersion(@Param('version') version: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.updatesService.setLatestVersion(version, req?.user?.id);
  }

  /**
   * Download update package
   */
  @Get('download/:version')
  @Public()
  @ApiOperation({ summary: 'Download update package' })
  async downloadUpdate(
    @Param('version') version: string,
    @Query('license') license: string,
    @Res() res: Response,
  ) {
    const appVersion = await this.updatesService.getVersion(version);
    if (!appVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const updateDir = process.env.UPDATE_PACKAGES_DIR || '/var/glide-hims/updates';
    const filePath = path.join(updateDir, `glide-hims-${version}.tar.gz`);

    if (!fs.existsSync(filePath)) {
      if (appVersion.downloadUrl) {
        return res.redirect(appVersion.downloadUrl);
      }
      return res.status(404).json({ error: 'Update package not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename=glide-hims-${version}.tar.gz`);
    res.setHeader('Content-Type', 'application/gzip');

    if (appVersion.checksum) {
      res.setHeader('X-Checksum-SHA256', appVersion.checksum);
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * Get changelog since version
   */
  @Get('changelog')
  @Public()
  @ApiOperation({ summary: 'Get changelog since a version' })
  async getChangelog(@Query('since') since: string) {
    const versions = await this.updatesService.getVersionsAfter(since);
    return versions.map((v) => ({
      version: v.version,
      releaseNotes: v.releaseNotes,
      releasedAt: v.releasedAt,
      isMandatory: v.isMandatory,
    }));
  }
}
