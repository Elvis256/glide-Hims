import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingEngineService } from './pricing-engine.service';
import {
  CreateInsurancePriceListDto,
  UpdateInsurancePriceListDto,
  BulkCreateInsurancePriceListDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
  ResolvePriceDto,
  PriceQueryDto,
} from './pricing-engine.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Pricing Engine')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('billing')
@Controller('pricing')
export class PricingEngineController {
  constructor(private readonly pricingService: PricingEngineService) {}

  // ==================== PRICE RESOLUTION ====================

  @Post('resolve')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Resolve final price for a service/lab test based on patient context' })
  resolvePrice(@Body() dto: ResolvePriceDto, @Request() req: any) {
    return this.pricingService.resolvePrice(dto, req.user?.tenantId);
  }

  @Get('compare')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Compare prices across insurance providers' })
  comparePrices(
    @Query('serviceId') serviceId?: string,
    @Query('labTestId') labTestId?: string,
    @Request() req?: any,
  ) {
    return this.pricingService.comparePrices(serviceId, labTestId, req?.user?.tenantId);
  }

  // ==================== INSURANCE PRICE LISTS ====================

  @Post('insurance-price-lists')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create insurance provider price list entry' })
  createInsurancePriceList(@Body() dto: CreateInsurancePriceListDto, @Request() req: any) {
    return this.pricingService.createInsurancePriceList(dto, req.user.sub, req.user?.tenantId);
  }

  @Post('insurance-price-lists/bulk')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Bulk create insurance provider price list entries' })
  bulkCreateInsurancePriceLists(@Body() dto: BulkCreateInsurancePriceListDto, @Request() req: any) {
    return this.pricingService.bulkCreateInsurancePriceLists(dto, req.user.sub, req.user?.tenantId);
  }

  @Get('insurance-price-lists')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get insurance price lists with filters' })
  getInsurancePriceLists(@Query() query: PriceQueryDto, @Request() req: any) {
    return this.pricingService.getInsurancePriceLists(query, req.user?.tenantId);
  }

  @Get('insurance-price-lists/:id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get insurance price list by ID' })
  getInsurancePriceListById(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.getInsurancePriceListById(id, req.user?.tenantId);
  }

  @Patch('insurance-price-lists/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update insurance price list entry' })
  updateInsurancePriceList(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInsurancePriceListDto,
    @Request() req: any,
  ) {
    return this.pricingService.updateInsurancePriceList(id, dto, req.user?.tenantId);
  }

  @Delete('insurance-price-lists/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete insurance price list entry' })
  deleteInsurancePriceList(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.deleteInsurancePriceList(id, req.user?.tenantId);
  }

  // ==================== PRICING RULES ====================

  @Post('rules')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create pricing rule' })
  createPricingRule(@Body() dto: CreatePricingRuleDto, @Request() req: any) {
    return this.pricingService.createPricingRule(dto, req.user.sub, req.user?.tenantId);
  }

  @Get('rules')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get all pricing rules' })
  getPricingRules(@Request() req: any) {
    return this.pricingService.getPricingRules(req.user?.tenantId);
  }

  @Get('rules/:id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get pricing rule by ID' })
  getPricingRuleById(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.getPricingRuleById(id, req.user?.tenantId);
  }

  @Patch('rules/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update pricing rule' })
  updatePricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingRuleDto,
    @Request() req: any,
  ) {
    return this.pricingService.updatePricingRule(id, dto, req.user?.id, req.user?.tenantId);
  }

  @Delete('rules/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete pricing rule' })
  deletePricingRule(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.deletePricingRule(id, req.user?.id, req.user?.tenantId);
  }

  // ==================== TAX RATES ====================
  @Post('tax-rates')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create tax rate' })
  createTaxRate(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createTaxRate(dto, req.user?.tenantId);
  }

  @Get('tax-rates')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get all tax rates' })
  getTaxRates(@Request() req: any) {
    return this.pricingService.getTaxRates(req.user?.tenantId);
  }

  @Patch('tax-rates/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update tax rate' })
  updateTaxRate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @Request() req: any) {
    return this.pricingService.updateTaxRate(id, dto, req.user?.tenantId);
  }

  @Delete('tax-rates/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete tax rate' })
  deleteTaxRate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.deleteTaxRate(id, req.user?.tenantId);
  }

  // ==================== TAX EXEMPTIONS ====================
  @Post('tax-exemptions')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create tax exemption' })
  createTaxExemption(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createTaxExemption(dto, req.user?.tenantId);
  }

  @Get('tax-exemptions')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get all tax exemptions' })
  getTaxExemptions(@Request() req: any) {
    return this.pricingService.getTaxExemptions(req.user?.tenantId);
  }

  @Patch('tax-exemptions/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update tax exemption' })
  updateTaxExemption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.pricingService.updateTaxExemption(id, dto, req.user?.tenantId);
  }

  @Delete('tax-exemptions/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete tax exemption' })
  deleteTaxExemption(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pricingService.deleteTaxExemption(id, req.user?.tenantId);
  }
}
