import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { v4 as uuidv4 } from 'uuid';

const WEBHOOKS = 'integrations.webhooks';
const EMAIL_TPL = 'integrations.email_templates';
const SSO_CFG = 'integrations.sso';

async function readArray(svc: SystemSettingsService, key: string, tenantId?: string): Promise<any[]> {
  try {
    const rec = await svc.getByKey(key, tenantId);
    return Array.isArray(rec.value) ? rec.value : [];
  } catch {
    return [];
  }
}

async function writeArray(
  svc: SystemSettingsService,
  key: string,
  value: any[],
  tenantId?: string,
) {
  return svc.upsert(key, value, tenantId);
}

@ApiTags('Admin - Integrations')
@ApiBearerAuth()
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(private readonly settings: SystemSettingsService) {}

  // ===== Webhooks =====
  @Get('webhooks')
  @AuthWithPermissions('settings.read')
  async listWebhooks(@Request() req: any) {
    return readArray(this.settings, WEBHOOKS, req.user?.tenantId);
  }

  @Post('webhooks')
  @AuthWithPermissions('settings.update')
  async createWebhook(@Body() dto: any, @Request() req: any) {
    const list = await readArray(this.settings, WEBHOOKS, req.user?.tenantId);
    const item = {
      id: uuidv4(),
      url: dto.url,
      events: dto.events || [],
      secret: dto.secret || '',
      active: dto.active !== false,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await writeArray(this.settings, WEBHOOKS, list, req.user?.tenantId);
    return item;
  }

  @Patch('webhooks/:id')
  @AuthWithPermissions('settings.update')
  async updateWebhook(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const list = await readArray(this.settings, WEBHOOKS, req.user?.tenantId);
    const idx = list.findIndex((w) => w.id === id);
    if (idx < 0) return { success: false };
    list[idx] = { ...list[idx], ...dto, id };
    await writeArray(this.settings, WEBHOOKS, list, req.user?.tenantId);
    return list[idx];
  }

  @Delete('webhooks/:id')
  @AuthWithPermissions('settings.update')
  async deleteWebhook(@Param('id') id: string, @Request() req: any) {
    const list = await readArray(this.settings, WEBHOOKS, req.user?.tenantId);
    const next = list.filter((w) => w.id !== id);
    await writeArray(this.settings, WEBHOOKS, next, req.user?.tenantId);
    return { success: true };
  }

  // ===== Email Templates =====
  @Get('email-templates')
  @AuthWithPermissions('settings.read')
  async listEmailTpl(@Request() req: any) {
    return readArray(this.settings, EMAIL_TPL, req.user?.tenantId);
  }

  @Post('email-templates')
  @AuthWithPermissions('settings.update')
  async createEmailTpl(@Body() dto: any, @Request() req: any) {
    const list = await readArray(this.settings, EMAIL_TPL, req.user?.tenantId);
    const item = {
      id: uuidv4(),
      name: dto.name,
      subject: dto.subject,
      body: dto.body,
      variables: dto.variables || [],
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await writeArray(this.settings, EMAIL_TPL, list, req.user?.tenantId);
    return item;
  }

  @Patch('email-templates/:id')
  @AuthWithPermissions('settings.update')
  async updateEmailTpl(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const list = await readArray(this.settings, EMAIL_TPL, req.user?.tenantId);
    const idx = list.findIndex((w) => w.id === id);
    if (idx < 0) return { success: false };
    list[idx] = { ...list[idx], ...dto, id };
    await writeArray(this.settings, EMAIL_TPL, list, req.user?.tenantId);
    return list[idx];
  }

  @Delete('email-templates/:id')
  @AuthWithPermissions('settings.update')
  async deleteEmailTpl(@Param('id') id: string, @Request() req: any) {
    const list = await readArray(this.settings, EMAIL_TPL, req.user?.tenantId);
    const next = list.filter((w) => w.id !== id);
    await writeArray(this.settings, EMAIL_TPL, next, req.user?.tenantId);
    return { success: true };
  }

  // ===== SSO config =====
  @Get('sso')
  @AuthWithPermissions('settings.read')
  async getSso(@Request() req: any) {
    try {
      const rec = await this.settings.getByKey(SSO_CFG, req.user?.tenantId);
      return rec.value || {};
    } catch {
      return {};
    }
  }

  @Post('sso')
  @AuthWithPermissions('settings.update')
  async updateSso(@Body() dto: any, @Request() req: any) {
    return this.settings.upsert(SSO_CFG, dto, req.user?.tenantId);
  }
}
