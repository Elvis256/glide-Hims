import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  @AuthWithPermissions('inventory.read')
  getCategories(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getCategories(facilityId, includeInactive === 'true');
  }

  @Get('categories/:id')
  @AuthWithPermissions('inventory.read')
  getCategory(@Param('id') id: string) {
    return this.service.getCategory(id);
  }

  @Put('categories/:id')
  @AuthWithPermissions('inventory.update')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @AuthWithPermissions('inventory.delete')
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }

  // ============ SUBCATEGORIES ============
  @Post('subcategories')
  @AuthWithPermissions('inventory.create')
  createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.service.createSubcategory(dto);
  }

  @Get('subcategories')
  @AuthWithPermissions('inventory.read')
  getSubcategories(
    @Query('categoryId') categoryId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getSubcategories(categoryId, includeInactive === 'true');
  }

  @Put('subcategories/:id')
  @AuthWithPermissions('inventory.update')
  updateSubcategory(@Param('id') id: string, @Body() dto: UpdateSubcategoryDto) {
    return this.service.updateSubcategory(id, dto);
  }

  @Delete('subcategories/:id')
  @AuthWithPermissions('inventory.delete')
  deleteSubcategory(@Param('id') id: string) {
    return this.service.deleteSubcategory(id);
  }

  // ============ BRANDS ============
  @Post('brands')
  @AuthWithPermissions('inventory.create')
  createBrand(@Body() dto: CreateBrandDto) {
    return this.service.createBrand(dto);
  }

  @Get('brands')
  @AuthWithPermissions('inventory.read')
  getBrands(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getBrands(facilityId, includeInactive === 'true');
  }

  @Put('brands/:id')
  @AuthWithPermissions('inventory.update')
  updateBrand(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.service.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  @AuthWithPermissions('inventory.delete')
  deleteBrand(@Param('id') id: string) {
    return this.service.deleteBrand(id);
  }

  // ============ TAGS ============
  @Post('tags')
  @AuthWithPermissions('inventory.create')
  createTag(@Body() dto: CreateTagDto) {
    return this.service.createTag(dto);
  }

  @Get('tags')
  @AuthWithPermissions('inventory.read')
  getTags(
    @Query('facilityId') facilityId: string,
    @Query('tagType') tagType?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getTags(facilityId, tagType, includeInactive === 'true');
  }

  @Put('tags/:id')
  @AuthWithPermissions('inventory.update')
  updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.service.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @AuthWithPermissions('inventory.delete')
  deleteTag(@Param('id') id: string) {
    return this.service.deleteTag(id);
  }

  // ============ UNITS ============
  @Post('units')
  @AuthWithPermissions('inventory.create')
  createUnit(@Body() dto: CreateUnitDto) {
    return this.service.createUnit(dto);
  }

  @Get('units')
  @AuthWithPermissions('inventory.read')
  getUnits(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getUnits(facilityId, includeInactive === 'true');
  }

  @Put('units/:id')
  @AuthWithPermissions('inventory.update')
  updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.service.updateUnit(id, dto);
  }

  @Delete('units/:id')
  @AuthWithPermissions('inventory.delete')
  deleteUnit(@Param('id') id: string) {
    return this.service.deleteUnit(id);
  }

  // ============ FORMULATIONS ============
  @Post('formulations')
  @AuthWithPermissions('inventory.create')
  createFormulation(@Body() dto: CreateFormulationDto) {
    return this.service.createFormulation(dto);
  }

  @Get('formulations')
  @AuthWithPermissions('inventory.read')
  getFormulations(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getFormulations(facilityId, includeInactive === 'true');
  }

  @Put('formulations/:id')
  @AuthWithPermissions('inventory.update')
  updateFormulation(@Param('id') id: string, @Body() dto: UpdateFormulationDto) {
    return this.service.updateFormulation(id, dto);
  }

  @Delete('formulations/:id')
  @AuthWithPermissions('inventory.delete')
  deleteFormulation(@Param('id') id: string) {
    return this.service.deleteFormulation(id);
  }

  // ============ STORAGE CONDITIONS ============
  @Post('storage-conditions')
  @AuthWithPermissions('inventory.create')
  createStorageCondition(@Body() dto: CreateStorageConditionDto) {
    return this.service.createStorageCondition(dto);
  }

  @Get('storage-conditions')
  @AuthWithPermissions('inventory.read')
  getStorageConditions(
    @Query('facilityId') facilityId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.getStorageConditions(facilityId, includeInactive === 'true');
  }

  @Put('storage-conditions/:id')
  @AuthWithPermissions('inventory.update')
  updateStorageCondition(@Param('id') id: string, @Body() dto: UpdateStorageConditionDto) {
    return this.service.updateStorageCondition(id, dto);
  }

  @Delete('storage-conditions/:id')
  @AuthWithPermissions('inventory.delete')
  deleteStorageCondition(@Param('id') id: string) {
    return this.service.deleteStorageCondition(id);
  }

  // ============ SEED DEFAULTS ============
  @Post('seed-defaults')
  @AuthWithPermissions('inventory.create')
  seedDefaults(@Query('facilityId') facilityId: string) {
    return this.service.seedDefaultClassifications(facilityId);
  }
}
