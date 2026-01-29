import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
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
  async create(@Body() dto: CreateProviderDto) {
    const provider = await this.providersService.create(dto);
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
  async findAll(@Query() query: ProviderSearchDto) {
    return this.providersService.findAll(query);
  }

  @Get('types')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider types' })
  async getProviderTypes() {
    return this.providersService.getProviderTypes();
  }

  @Get('specialties')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get specialties list' })
  @ApiQuery({ name: 'facilityId', required: false })
  async getSpecialties(@Query('facilityId') facilityId?: string) {
    return this.providersService.getSpecialties(facilityId);
  }

  @Get('surgeons/:facilityId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get surgeons for facility' })
  async getSurgeons(@Param('facilityId', ParseUUIDPipe) facilityId: string) {
    return this.providersService.getSurgeons(facilityId);
  }

  @Get('prescribers/:facilityId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get prescribers for facility' })
  async getPrescribers(@Param('facilityId', ParseUUIDPipe) facilityId: string) {
    return this.providersService.getPrescribers(facilityId);
  }

  @Get('license-expiry')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get providers with expiring licenses' })
  @ApiQuery({ name: 'daysAhead', required: false })
  async checkLicenseExpiry(@Query('daysAhead') daysAhead?: number) {
    return this.providersService.checkLicenseExpiry(daysAhead || 30);
  }

  @Get('user/:userId')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider by user ID' })
  async findByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.providersService.findByUserId(userId);
  }

  @Get(':id')
  @AuthWithPermissions('providers.read')
  @ApiOperation({ summary: 'Get provider by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.providersService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('providers.update')
  @ApiOperation({ summary: 'Update provider' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProviderDto) {
    const provider = await this.providersService.update(id, dto);
    return { message: 'Provider updated', data: provider };
  }

  @Patch(':id/status')
  @AuthWithPermissions('providers.update')
  @ApiOperation({ summary: 'Update provider status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProviderStatus,
  ) {
    const provider = await this.providersService.updateStatus(id, status);
    return { message: 'Provider status updated', data: provider };
  }

  @Delete(':id')
  @AuthWithPermissions('providers.delete')
  @ApiOperation({ summary: 'Delete provider' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.providersService.remove(id);
    return { message: 'Provider deleted' };
  }
}
