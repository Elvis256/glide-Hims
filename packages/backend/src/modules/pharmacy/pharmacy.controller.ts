import {
  Controller, Get, Post, Body, Param, Query, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { CreatePharmacySaleDto, CompleteSaleDto } from './pharmacy.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SaleStatus } from '../../database/entities/pharmacy-sale.entity';

@ApiTags('Pharmacy POS')
@ApiBearerAuth()
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly service: PharmacyService) {}

  @Post('sales')
  @AuthWithPermissions('pharmacy.create')
  @ApiOperation({ summary: 'Create pharmacy sale (walk-in or prescription)' })
  createSale(@Body() dto: CreatePharmacySaleDto, @Request() req: any) {
    return this.service.createSale(dto, req.user.id);
  }

  @Get('sales')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'List pharmacy sales' })
  findAllSales(
    @Query('storeId') storeId?: string,
    @Query('status') status?: SaleStatus,
    @Query('date') date?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAllSales(storeId, status, date, limit);
  }

  @Get('sales/:id')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get sale by ID' })
  findSale(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findSale(id);
  }

  @Post('sales/:id/complete')
  @AuthWithPermissions('pharmacy.update')
  @ApiOperation({ summary: 'Complete sale with payment' })
  completeSale(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteSaleDto, @Request() req: any) {
    return this.service.completeSale(id, dto, req.user.id);
  }

  @Post('sales/:id/cancel')
  @AuthWithPermissions('pharmacy.delete')
  @ApiOperation({ summary: 'Cancel pending sale' })
  cancelSale(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancelSale(id);
  }

  @Get('summary/daily')
  @AuthWithPermissions('pharmacy.read')
  @ApiOperation({ summary: 'Get daily sales summary' })
  getDailySummary(@Query('storeId') storeId: string, @Query('date') date: string) {
    return this.service.getDailySummary(storeId, date);
  }
}
