import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateServicePriceDto,
  CreateServicePackageDto,
  CreateServiceConsumableDto,
  UpdateServiceConsumableDto,
} from './services.dto';
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
  createCategory(@Body() dto: CreateServiceCategoryDto, @Request() req: any) {
    return this.service.createCategory(dto, req.user?.tenantId);
  }

  @Get('categories')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all service categories' })
  findAllCategories(@Request() req: any) {
    return this.service.findAllCategories(req.user?.tenantId);
  }

  @Patch('categories/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update service category' })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCategoryDto,
    @Request() req: any,
  ) {
    return this.service.updateCategory(id, dto, req.user?.tenantId);
  }

  @Delete('categories/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete service category' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.deleteCategory(id, req.user?.tenantId);
  }

  // === PACKAGES (must be before :id routes) ===
  @Post('packages')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create service package' })
  createPackage(@Body() dto: CreateServicePackageDto, @Request() req: any) {
    return this.service.createPackage(dto, req.user?.tenantId);
  }

  @Get('packages')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all service packages' })
  findAllPackages(@Request() req: any) {
    return this.service.findAllPackages(req.user?.tenantId);
  }

  @Patch('packages/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update service package' })
  updatePackage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateServicePackageDto>,
    @Request() req: any,
  ) {
    return this.service.updatePackage(id, dto, req.user?.tenantId);
  }

  @Delete('packages/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete service package' })
  deletePackage(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.deletePackage(id, req.user?.tenantId);
  }

  // === PRICES ===
  @Post('prices')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Set service price for tier' })
  createPrice(@Body() dto: CreateServicePriceDto, @Request() req: any) {
    return this.service.createPrice(dto, req.user?.tenantId);
  }

  // === SERVICES ===
  @Post()
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create service' })
  createService(@Body() dto: CreateServiceDto, @Request() req: any) {
    return this.service.createService(dto, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List all services' })
  findAllServices(
    @Query('categoryId') categoryId?: string,
    @Query('tier') tier?: ServiceTier,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.findAllServices(
      categoryId,
      tier,
      includeInactive === 'true',
      req?.user?.tenantId,
    );
  }

  @Get(':id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get service by ID' })
  findService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findService(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update service' })
  updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @Request() req: any,
  ) {
    return this.service.updateService(id, dto, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete service' })
  deleteService(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.deleteService(id, req.user?.tenantId);
  }

  @Get(':id/price')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get current price for service and tier' })
  getServicePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tier') tier: ServiceTier = ServiceTier.STANDARD,
    @Query('facilityId') facilityId?: string,
    @Request() req?: any,
  ) {
    return this.service.getServicePrice(id, tier, facilityId, req?.user?.tenantId);
  }

  // === CONSUMABLES (auto-deduct items when service rendered) ===
  @Get(':id/consumables')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'List inventory items consumed by this service' })
  listConsumables(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.listConsumables(id, req.user?.tenantId);
  }

  @Post(':id/consumables')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Link an inventory item to this service' })
  addConsumable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceConsumableDto,
    @Request() req: any,
  ) {
    return this.service.addConsumable(id, dto, req.user?.tenantId);
  }

  @Patch('consumables/:cid')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update a service consumable link' })
  updateConsumable(
    @Param('cid', ParseUUIDPipe) cid: string,
    @Body() dto: UpdateServiceConsumableDto,
    @Request() req: any,
  ) {
    return this.service.updateConsumable(cid, dto, req.user?.tenantId);
  }

  @Delete('consumables/:cid')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Remove a service consumable link' })
  deleteConsumable(@Param('cid', ParseUUIDPipe) cid: string, @Request() req: any) {
    return this.service.deleteConsumable(cid, req.user?.tenantId);
  }
}
