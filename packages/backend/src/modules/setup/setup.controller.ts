import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SetupService } from './setup.service';
import { InitializeSetupDto } from './dto/setup.dto';

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
        organizationName: { type: 'string' },
        facilityName: { type: 'string' },
      }
    }
  })
  async getSetupStatus() {
    return this.setupService.getSetupStatus();
  }

  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Get deployment configuration (deployment mode, registration enabled)' })
  async getConfig() {
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'standalone';
    return {
      deploymentMode,
      registrationEnabled: deploymentMode === 'multi-tenant',
      platformName: process.env.PLATFORM_NAME || 'Glide HIMS',
    };
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
  async initializeSetup(@Body() dto: InitializeSetupDto) {
    return this.setupService.initializeSetup(dto);
  }
}
