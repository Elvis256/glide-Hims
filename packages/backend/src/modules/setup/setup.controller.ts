import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { SetupService } from './setup.service';
import { InitializeSetupDto, RegisterTenantDto, InitializeTenantSetupDto } from './dto/setup.dto';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Check if initial setup has been completed' })
  @ApiResponse({ 
    status: 200, 
    description: 'Setup status',
    schema: {
      type: 'object',
      properties: {
        isSetupComplete: { type: 'boolean' },
        deploymentMode: { type: 'string', enum: ['on-premise', 'saas'] },
        organizationName: { type: 'string' },
        facilityName: { type: 'string' },
        tenantSlug: { type: 'string' },
      }
    }
  })
  async getSetupStatus() {
    return this.setupService.getSetupStatus();
  }

  @Get('presets')
  @Public()
  @ApiOperation({ summary: 'Get available facility deployment mode presets' })
  @ApiResponse({ status: 200, description: 'List of deployment mode presets' })
  getPresets() {
    return this.setupService.getPresets();
  }

  @Post('initialize')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize system with organization, facility, and admin user' })
  @ApiResponse({ status: 201, description: 'Setup completed successfully' })
  @ApiResponse({ status: 400, description: 'Setup already completed or validation error' })
  @ApiResponse({ status: 403, description: 'Setup already completed — re-initialization blocked' })
  async initializeSetup(@Body() dto: InitializeSetupDto) {
    // Double-check setup status before allowing initialization
    const status = await this.setupService.getSetupStatus();
    if (status.isSetupComplete) {
      throw new ForbiddenException('System is already initialized. Re-initialization is not allowed.');
    }
    return this.setupService.initializeSetup(dto);
  }

  @Post('register-tenant')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new organization (self-service)' })
  @ApiResponse({ status: 201, description: 'Organization registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate organization/user' })
  async registerTenant(@Body() dto: RegisterTenantDto) {
    return this.setupService.registerTenant(dto);
  }

  @Post('initialize-tenant/:slug')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize setup for an existing tenant (facility, admin, settings)' })
  @ApiResponse({ status: 201, description: 'Tenant setup completed successfully' })
  @ApiResponse({ status: 400, description: 'Setup already completed or validation error' })
  async initializeTenantSetup(
    @Param('slug') slug: string,
    @Body() dto: InitializeTenantSetupDto,
  ) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 100) {
      throw new BadRequestException('Invalid organization code');
    }
    return this.setupService.initializeTenantSetup(slug, dto);
  }
}
