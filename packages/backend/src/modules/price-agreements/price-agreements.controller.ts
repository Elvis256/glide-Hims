import { Controller, Get, Post, Put, Body, Param, Query, Request } from '@nestjs/common';
import { PriceAgreementsService } from './price-agreements.service';
import { CreatePriceAgreementDto, UpdatePriceAgreementDto, ComparePricesDto } from './dto/price-agreement.dto';
import { PriceAgreementStatus } from '../../database/entities/price-agreement.entity';

@Controller('price-agreements')
export class PriceAgreementsController {
  constructor(private readonly service: PriceAgreementsService) {}

  @Post()
  create(@Body() dto: CreatePriceAgreementDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: PriceAgreementStatus,
    @Query('supplierId') supplierId?: string,
    @Query('itemCode') itemCode?: string,
  ) {
    return this.service.findAll(facilityId, { status, supplierId, itemCode });
  }

  @Get('stats')
  getStats(@Query('facilityId') facilityId: string) {
    return this.service.getStats(facilityId);
  }

  @Get('expiring')
  getExpiring(@Query('facilityId') facilityId: string, @Query('daysAhead') daysAhead?: number) {
    return this.service.checkExpiringAgreements(facilityId, daysAhead);
  }

  @Post('compare')
  comparePrices(@Query('facilityId') facilityId: string, @Body() dto: ComparePricesDto) {
    return this.service.comparePrices(facilityId, dto);
  }

  @Get('best-price/:itemCode')
  getBestPrice(
    @Query('facilityId') facilityId: string,
    @Param('itemCode') itemCode: string,
    @Query('quantity') quantity?: number,
  ) {
    return this.service.getBestPrice(facilityId, itemCode, quantity);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceAgreementDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @Request() req: any) {
    return this.service.activate(id, req.user?.id || 'system');
  }

  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.service.terminate(id, body.reason);
  }
}
