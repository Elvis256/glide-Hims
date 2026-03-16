import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { ItemClassificationsService } from './item-classifications.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
  CreateBrandDto,
  UpdateBrandDto,
  CreateTagDto,
  UpdateTagDto,
  CreateUnitDto,
  UpdateUnitDto,
  CreateFormulationDto,
  UpdateFormulationDto,
  CreateStorageConditionDto,
  UpdateStorageConditionDto,
} from './item-classifications.dto';

@Controller('item-classifications')
export class ItemClassificationsController {
  constructor(private readonly service: ItemClassificationsService) {}

  // ============ CATEGORIES ============
  @Post('categories')
  @AuthWithPermissions('inventory.create')
  createCategory(@Body() dto: CreateCategoryDto, @Request() req: any) {
    return this.service.createCategory(dto, req.user?.tenantId);
  }

  @Get('categories')
  @AuthWithPermissions('inventory.read')
  getCategories(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getCategories(facilityId, includeInactive === 'true', req.user?.tenantId);
  }

  @Get('categories/:id')
  @AuthWithPermissions('inventory.read')
  getCategory(@Param('id') id: string, @Request() req: any) {
    return this.service.getCategory(id, req.user?.tenantId);
  }

  @Put('categories/:id')
  @AuthWithPermissions('inventory.update')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Request() req: any) {
    return this.service.updateCategory(id, dto, req.user?.tenantId);
  }

  @Delete('categories/:id')
  @AuthWithPermissions('inventory.delete')
  deleteCategory(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteCategory(id, req.user?.tenantId);
  }

  // ============ SUBCATEGORIES ============
  @Post('subcategories')
  @AuthWithPermissions('inventory.create')
  createSubcategory(@Body() dto: CreateSubcategoryDto, @Request() req: any) {
    return this.service.createSubcategory(dto, req.user?.tenantId);
  }

  @Get('subcategories')
  @AuthWithPermissions('inventory.read')
  getSubcategories(
    @Query('categoryId') categoryId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getSubcategories(categoryId, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('subcategories/:id')
  @AuthWithPermissions('inventory.update')
  updateSubcategory(@Param('id') id: string, @Body() dto: UpdateSubcategoryDto, @Request() req: any) {
    return this.service.updateSubcategory(id, dto, req.user?.tenantId);
  }

  @Delete('subcategories/:id')
  @AuthWithPermissions('inventory.delete')
  deleteSubcategory(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteSubcategory(id, req.user?.tenantId);
  }

  // ============ BRANDS ============
  @Post('brands')
  @AuthWithPermissions('inventory.create')
  createBrand(@Body() dto: CreateBrandDto, @Request() req: any) {
    return this.service.createBrand(dto, req.user?.tenantId);
  }

  @Get('brands')
  @AuthWithPermissions('inventory.read')
  getBrands(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getBrands(facilityId, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('brands/:id')
  @AuthWithPermissions('inventory.update')
  updateBrand(@Param('id') id: string, @Body() dto: UpdateBrandDto, @Request() req: any) {
    return this.service.updateBrand(id, dto, req.user?.tenantId);
  }

  @Delete('brands/:id')
  @AuthWithPermissions('inventory.delete')
  deleteBrand(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteBrand(id, req.user?.tenantId);
  }

  // ============ TAGS ============
  @Post('tags')
  @AuthWithPermissions('inventory.create')
  createTag(@Body() dto: CreateTagDto, @Request() req: any) {
    return this.service.createTag(dto, req.user?.tenantId);
  }

  @Get('tags')
  @AuthWithPermissions('inventory.read')
  getTags(
    @Query('facilityId') facilityId: string,
    @Query('tagType') tagType?: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getTags(facilityId, tagType, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('tags/:id')
  @AuthWithPermissions('inventory.update')
  updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto, @Request() req: any) {
    return this.service.updateTag(id, dto, req.user?.tenantId);
  }

  @Delete('tags/:id')
  @AuthWithPermissions('inventory.delete')
  deleteTag(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteTag(id, req.user?.tenantId);
  }

  // ============ UNITS ============
  @Post('units')
  @AuthWithPermissions('inventory.create')
  createUnit(@Body() dto: CreateUnitDto, @Request() req: any) {
    return this.service.createUnit(dto, req.user?.tenantId);
  }

  @Get('units')
  @AuthWithPermissions('inventory.read')
  getUnits(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getUnits(facilityId, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('units/:id')
  @AuthWithPermissions('inventory.update')
  updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto, @Request() req: any) {
    return this.service.updateUnit(id, dto, req.user?.tenantId);
  }

  @Delete('units/:id')
  @AuthWithPermissions('inventory.delete')
  deleteUnit(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteUnit(id, req.user?.tenantId);
  }

  // ============ FORMULATIONS ============
  @Post('formulations')
  @AuthWithPermissions('inventory.create')
  createFormulation(@Body() dto: CreateFormulationDto, @Request() req: any) {
    return this.service.createFormulation(dto, req.user?.tenantId);
  }

  @Get('formulations')
  @AuthWithPermissions('inventory.read')
  getFormulations(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getFormulations(facilityId, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('formulations/:id')
  @AuthWithPermissions('inventory.update')
  updateFormulation(@Param('id') id: string, @Body() dto: UpdateFormulationDto, @Request() req: any) {
    return this.service.updateFormulation(id, dto, req.user?.tenantId);
  }

  @Delete('formulations/:id')
  @AuthWithPermissions('inventory.delete')
  deleteFormulation(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteFormulation(id, req.user?.tenantId);
  }

  // ============ STORAGE CONDITIONS ============
  @Post('storage-conditions')
  @AuthWithPermissions('inventory.create')
  createStorageCondition(@Body() dto: CreateStorageConditionDto, @Request() req: any) {
    return this.service.createStorageCondition(dto, req.user?.tenantId);
  }

  @Get('storage-conditions')
  @AuthWithPermissions('inventory.read')
  getStorageConditions(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
    @Request() req?: any,
  ) {
    return this.service.getStorageConditions(facilityId, includeInactive === 'true', req.user?.tenantId);
  }

  @Put('storage-conditions/:id')
  @AuthWithPermissions('inventory.update')
  updateStorageCondition(@Param('id') id: string, @Body() dto: UpdateStorageConditionDto, @Request() req: any) {
    return this.service.updateStorageCondition(id, dto, req.user?.tenantId);
  }

  @Delete('storage-conditions/:id')
  @AuthWithPermissions('inventory.delete')
  deleteStorageCondition(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteStorageCondition(id, req.user?.tenantId);
  }

  // ============ SEED DEFAULTS ============
  @Post('seed-defaults')
  @AuthWithPermissions('inventory.create')
  seedDefaults(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.service.seedDefaultClassifications(facilityId, req.user?.tenantId);
  }
}
