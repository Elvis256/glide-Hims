import { Controller, Get, Post, Body, Param, Query, Request } from '@nestjs/common';
import { InvoiceMatchingService } from './invoice-matching.service';
import { CreateInvoiceMatchDto, ApproveMatchDto } from './dto/invoice-match.dto';
import { InvoiceMatchStatus } from '../../database/entities/invoice-match.entity';

@Controller('invoice-matching')
export class InvoiceMatchingController {
  constructor(private readonly service: InvoiceMatchingService) {}

  @Post()
  create(@Body() dto: CreateInvoiceMatchDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  findAll(@Query('facilityId') facilityId: string, @Query('status') status?: InvoiceMatchStatus) {
    return this.service.findAll(facilityId, { status });
  }

  @Get('stats')
  getStats(@Query('facilityId') facilityId: string) {
    return this.service.getStats(facilityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('items/:itemId/resolve')
  resolveItem(@Param('itemId') itemId: string, @Body() dto: { qtyMatch: boolean; priceMatch: boolean }, @Request() req: any) {
    return this.service.resolveItem(itemId, dto, req.user?.id || 'system');
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveMatchDto, @Request() req: any) {
    return this.service.approve(id, dto, req.user?.id || 'system');
  }

  @Post(':id/paid')
  markAsPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id);
  }

  @Post(':id/flag')
  flag(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.service.flag(id, body.reason);
  }
}
