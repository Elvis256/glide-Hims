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

@ApiTags('Pricing Engine')
@ApiBearerAuth()
@Controller('pricing')
export class PricingEngineController {
  constructor(private readonly pricingService: PricingEngineService) {}

  // ==================== PRICE RESOLUTION ====================

  @Post('resolve')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Resolve final price for a service/lab test based on patient context' })
  resolvePrice(@Body() dto: ResolvePriceDto) {
    return this.pricingService.resolvePrice(dto);
  }

  @Get('compare')
  @AuthWithPermissions('billing.read')
  @ApiOperation({ summary: 'Compare prices across insurance providers' })
  comparePrices(
    @Query('serviceId') serviceId?: string,
    @Query('labTestId') labTestId?: string,
  ) {
    return this.pricingService.comparePrices(serviceId, labTestId);
  }

  // ==================== INSURANCE PRICE LISTS ====================

  @Post('insurance-price-lists')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create insurance provider price list entry' })
  createInsurancePriceList(@Body() dto: CreateInsurancePriceListDto, @Request() req: any) {
    return this.pricingService.createInsurancePriceList(dto, req.user.sub);
  }

  @Post('insurance-price-lists/bulk')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Bulk create insurance provider price list entries' })
  bulkCreateInsurancePriceLists(@Body() dto: BulkCreateInsurancePriceListDto, @Request() req: any) {
    return this.pricingService.bulkCreateInsurancePriceLists(dto, req.user.sub);
  }

  @Get('insurance-price-lists')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get insurance price lists with filters' })
  getInsurancePriceLists(@Query() query: PriceQueryDto) {
    return this.pricingService.getInsurancePriceLists(query);
  }

  @Get('insurance-price-lists/:id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get insurance price list by ID' })
  getInsurancePriceListById(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.getInsurancePriceListById(id);
  }

  @Patch('insurance-price-lists/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update insurance price list entry' })
  updateInsurancePriceList(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInsurancePriceListDto,
  ) {
    return this.pricingService.updateInsurancePriceList(id, dto);
  }

  @Delete('insurance-price-lists/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete insurance price list entry' })
  deleteInsurancePriceList(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.deleteInsurancePriceList(id);
  }

  // ==================== PRICING RULES ====================

  @Post('rules')
  @AuthWithPermissions('services.create')
  @ApiOperation({ summary: 'Create pricing rule' })
  createPricingRule(@Body() dto: CreatePricingRuleDto, @Request() req: any) {
    return this.pricingService.createPricingRule(dto, req.user.sub);
  }

  @Get('rules')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get all pricing rules' })
  getPricingRules() {
    return this.pricingService.getPricingRules();
  }

  @Get('rules/:id')
  @AuthWithPermissions('services.read')
  @ApiOperation({ summary: 'Get pricing rule by ID' })
  getPricingRuleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.getPricingRuleById(id);
  }

  @Patch('rules/:id')
  @AuthWithPermissions('services.update')
  @ApiOperation({ summary: 'Update pricing rule' })
  updatePricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingService.updatePricingRule(id, dto);
  }

  @Delete('rules/:id')
  @AuthWithPermissions('services.delete')
  @ApiOperation({ summary: 'Delete pricing rule' })
  deletePricingRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricingService.deletePricingRule(id);
  }
}
