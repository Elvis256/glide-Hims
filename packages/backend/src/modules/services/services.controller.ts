import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto, CreateServiceDto, UpdateServiceDto, CreateServicePriceDto, CreateServicePackageDto } from './services.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ServiceTier } from '../../database/entities/service-category.entity';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  // === CATEGORIES ===
  @Post('categories')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create service category' })
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all service categories' })
  findAllCategories() {
    return this.service.findAllCategories();
  }

  @Patch('categories/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update service category' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  // === PACKAGES (must be before :id routes) ===
  @Post('packages')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create service package' })
  createPackage(@Body() dto: CreateServicePackageDto) {
    return this.service.createPackage(dto);
  }

  @Get('packages')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all service packages' })
  findAllPackages() {
    return this.service.findAllPackages();
  }

  // === PRICES ===
  @Post('prices')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Set service price for tier' })
  createPrice(@Body() dto: CreateServicePriceDto) {
    return this.service.createPrice(dto);
  }

  // === SERVICES ===
  @Post()
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create service' })
  createService(@Body() dto: CreateServiceDto) {
    return this.service.createService(dto);
  }

  @Get()
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all services' })
  findAllServices(@Query('categoryId') categoryId?: string, @Query('tier') tier?: ServiceTier) {
    return this.service.findAllServices(categoryId, tier);
  }

  @Get(':id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get service by ID' })
  findService(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findService(id);
  }

  @Patch(':id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update service' })
  updateService(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.service.updateService(id, dto);
  }

  @Get(':id/price')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get current price for service and tier' })
  getServicePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tier') tier: ServiceTier = ServiceTier.STANDARD,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.service.getServicePrice(id, tier, facilityId);
  }
}
