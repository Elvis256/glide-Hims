import { Controller, Get, Post, Body, Param, Query, Request } from '@nestjs/common';
import { InvoiceMatchingService } from './invoice-matching.service';
import { CreateInvoiceMatchDto, ApproveMatchDto } from './dto/invoice-match.dto';
import { InvoiceMatchStatus } from '../../database/entities/invoice-match.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@Controller('invoice-matching')
export class InvoiceMatchingController {
  constructor(private readonly service: InvoiceMatchingService) {}

  @AuthWithPermissions('procurement.create')
  @Post()
  create(@Body() dto: CreateInvoiceMatchDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get()
  findAll(@Query('facilityId') facilityId: string, @Query('status') status?: InvoiceMatchStatus, @Request() req?: any) {
    return this.service.findAll(facilityId, { status }, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('stats')
  getStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.service.getStats(facilityId, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post('items/:itemId/resolve')
  resolveItem(@Param('itemId') itemId: string, @Body() dto: { qtyMatch: boolean; priceMatch: boolean }, @Request() req: any) {
    return this.service.resolveItem(itemId, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.approve')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveMatchDto, @Request() req: any) {
    return this.service.approve(id, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/paid')
  markAsPaid(@Param('id') id: string, @Request() req: any) {
    return this.service.markAsPaid(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/flag')
  flag(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.service.flag(id, body.reason, req.user?.tenantId);
  }
}
