import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';

@ApiTags('SaaS Onboarding')
@Controller('saas-revenue/onboardings')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  private assertAdmin(req: any) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
  }

  @Get()
  @ApiOperation({ summary: 'List onboardings' })
  async list(@Req() req: any, @Query('status') status?: string) {
    this.assertAdmin(req);
    return this.service.listOnboardings({ status });
  }

  @Post()
  @ApiOperation({ summary: 'Create an onboarding' })
  async create(@Req() req: any, @Body() dto: any) {
    this.assertAdmin(req);
    return this.service.createOnboarding(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get onboarding with items' })
  async get(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.getOnboarding(id);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update an onboarding item' })
  async updateItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: any) {
    this.assertAdmin(req);
    return this.service.updateItem(id, itemId, dto);
  }

  @Post(':id/go-live')
  @ApiOperation({ summary: 'Mark onboarding as go-live' })
  async goLive(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.markGoLive(id);
  }
}
