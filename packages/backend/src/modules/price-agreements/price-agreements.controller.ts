import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { PriceAgreementsService } from './price-agreements.service';
import {
  CreatePriceAgreementDto,
  UpdatePriceAgreementDto,
  ComparePricesDto,
} from './dto/price-agreement.dto';
import { PriceAgreementStatus } from '../../database/entities/price-agreement.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('price-agreements')
export class PriceAgreementsController {
  constructor(private readonly service: PriceAgreementsService) {}

  @AuthWithPermissions('procurement.create')
  @Post()
  create(@Body() dto: CreatePriceAgreementDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PriceAgreementStatus,
    @Query('supplierId') supplierId?: string,
    @Query('itemCode') itemCode?: string,
    @Request() req?: any,
  ) {
    return this.service.findAll(facilityId, { status, supplierId, itemCode }, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('stats')
  getStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.service.getStats(facilityId, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('expiring')
  getExpiring(
    @Query('facilityId') facilityId: string,
    @Query('daysAhead') daysAhead?: number,
    @Request() req?: any,
  ) {
    return this.service.checkExpiringAgreements(facilityId, daysAhead, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post('compare')
  comparePrices(
    @Query('facilityId') facilityId: string,
    @Body() dto: ComparePricesDto,
    @Request() req: any,
  ) {
    return this.service.comparePrices(facilityId, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('best-price/:itemCode')
  getBestPrice(
    @Query('facilityId') facilityId: string,
    @Param('itemCode') itemCode: string,
    @Query('quantity') quantity?: number,
    @Request() req?: any,
  ) {
    return this.service.getBestPrice(facilityId, itemCode, quantity, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceAgreementDto, @Request() req: any) {
    return this.service.update(id, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/activate')
  activate(@Param('id') id: string, @Request() req: any) {
    return this.service.activate(id, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.service.terminate(id, body.reason, req.user?.tenantId);
  }
}
