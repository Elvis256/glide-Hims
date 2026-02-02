import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { VendorRatingsService } from './vendor-ratings.service';
import { CreateVendorRatingDto, UpdateVendorRatingDto } from './dto/vendor-rating.dto';

@Controller('vendor-ratings')
export class VendorRatingsController {
  constructor(private readonly service: VendorRatingsService) {}

  @Post()
  create(@Body() dto: CreateVendorRatingDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  findAll(@Query('facilityId') facilityId: string, @Query('supplierId') supplierId?: string) {
    return this.service.findAll(facilityId, { supplierId });
  }

  @Get('summaries')
  getAllSummaries() {
    return this.service.getAllSummaries();
  }

  @Get('top')
  getTopVendors(@Query('limit') limit?: number) {
    return this.service.getTopVendors(limit);
  }

  @Get('summary/:supplierId')
  getSummary(@Param('supplierId') supplierId: string) {
    return this.service.getSummary(supplierId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorRatingDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
