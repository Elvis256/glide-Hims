import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { ApiKeyService } from '../services/api-key.service';

@ApiTags('Admin - API Keys')
@ApiBearerAuth()
@Controller('admin/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System administrator access required');
    }
  }

  @Post()
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Create API key (returns raw key once)' })
  async create(
    @Body() dto: {
      name: string;
      scopes: string[];
      rateLimitPerHour?: number;
      expiresInDays?: number;
      ipWhitelist?: string;
    },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    const result = await this.apiKeyService.createApiKey(dto, req.user.id || req.user.sub);
    return {
      message: 'API key created. Copy the key now — it cannot be retrieved later.',
      rawKey: result.rawKey,
      apiKey: result.apiKey,
    };
  }

  @Get()
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'List API keys' })
  async list(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.apiKeyService.listApiKeys();
  }

  @Get('stats')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'API key usage statistics' })
  async stats(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.apiKeyService.getKeyUsageStats();
  }

  @Get(':id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Get API key details' })
  async get(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.apiKeyService.getApiKey(id);
  }

  @Patch(':id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Update API key' })
  async update(
    @Param('id') id: string,
    @Body() dto: {
      name?: string;
      scopes?: string[];
      rateLimitPerHour?: number;
      isActive?: boolean;
      ipWhitelist?: string;
    },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    return this.apiKeyService.updateApiKey(id, dto);
  }

  @Post(':id/rotate')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Rotate API key (creates new, revokes old)' })
  async rotate(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const result = await this.apiKeyService.rotateApiKey(id, req.user.id || req.user.sub);
    return {
      message: 'API key rotated. Copy the new key now — it cannot be retrieved later.',
      rawKey: result.rawKey,
      apiKey: result.apiKey,
    };
  }

  @Delete(':id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Revoke API key' })
  async revoke(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    await this.apiKeyService.revokeApiKey(id);
    return { success: true, message: 'API key revoked' };
  }

  // ===== Webhook Delivery Logs =====

  @Get('webhooks/delivery-logs')
  @AuthWithPermissions('settings.read')
  @ApiOperation({ summary: 'Webhook delivery logs' })
  async webhookLogs(
    @Query('webhookId') webhookId: string,
    @Query('limit') limit: number,
    @Request() req: any,
  ) {
    return this.apiKeyService.listWebhookLogs(webhookId, req.user?.tenantId, Number(limit) || 100);
  }

  @Get('webhooks/delivery-stats')
  @AuthWithPermissions('settings.read')
  @ApiOperation({ summary: 'Webhook delivery statistics' })
  async webhookStats(@Request() req: any) {
    return this.apiKeyService.getWebhookDeliveryStats(req.user?.tenantId);
  }
}
