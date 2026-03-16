import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { CreateProviderDto, UpdateProviderDto, ProviderSearchDto } from './dto/provider.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ProviderType, ProviderStatus } from '../../database/entities/provider.entity';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @AuthWithPermissions('providers.create')
  @ApiOperation({ summary: 'Create provider' })
  async create(@Body() dto: CreateProviderDto, @Request() req: any) {
    const provider = await this.providersService.create(dto, req.user?.tenantId);
    return { message: 'Provider created', data: provider };
  }

  @Get()
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'List providers' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'providerType', required: false, enum: ProviderType })
  @ApiQuery({ name: 'specialty', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ProviderStatus })
  async findAll(@Query() query: ProviderSearchDto, @Request() req: any) {
    return this.providersService.findAll(query, req.user?.tenantId);
  }

  @Get('types')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider types' })
  async getProviderTypes(@Request() req: any) {
    return this.providersService.getProviderTypes();
  }

  @Get('specialties')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get specialties list' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getSpecialties(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.providersService.getSpecialties(facilityId, req?.user?.tenantId);
  }

  @Get('surgeons/:facilityId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get surgeons for facility' })
  async getSurgeons(@Param('facilityId', ParseUUIDPipe) facilityId: string, @Request() req: any) {
    return this.providersService.getSurgeons(facilityId, req.user?.tenantId);
  }

  @Get('prescribers/:facilityId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get prescribers for facility' })
  async getPrescribers(@Param('facilityId', ParseUUIDPipe) facilityId: string, @Request() req: any) {
    return this.providersService.getPrescribers(facilityId, req.user?.tenantId);
  }

  @Get('license-expiry')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get providers with expiring licenses' })
  @ApiQuery({ name: 'daysAhead', required: false })
  async checkLicenseExpiry(@Query('daysAhead') daysAhead?: number, @Request() req?: any) {
    return this.providersService.checkLicenseExpiry(daysAhead || 30, req?.user?.tenantId);
  }

  @Get('user/:userId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider by user ID' })
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string, @Request() req: any) {
    return this.providersService.findByUserId(userId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.providersService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('providers.update')
  @ApiOperation({ summary: 'Update provider' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProviderDto, @Request() req: any) {
    const provider = await this.providersService.update(id, dto, req.user?.tenantId);
    return { message: 'Provider updated', data: provider };
  }

  @Patch(':id/status')
  @AuthWithPermissions('providers.update')
  @ApiOperation({ summary: 'Update provider status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProviderStatus,
    @Request() req: any,
  ) {
    const provider = await this.providersService.updateStatus(id, status, req.user?.tenantId);
    return { message: 'Provider status updated', data: provider };
  }

  @Delete(':id')
  @AuthWithPermissions('providers.delete')
  @ApiOperation({ summary: 'Delete provider' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.providersService.remove(id, req.user?.tenantId);
    return { message: 'Provider deleted' };
  }
}
