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
  UseGuards,
} from '@nestjs/common';
import { VendorRatingsService } from './vendor-ratings.service';
import { CreateVendorRatingDto, UpdateVendorRatingDto } from './dto/vendor-rating.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('vendor-ratings')
export class VendorRatingsController {
  constructor(private readonly service: VendorRatingsService) {}

  @AuthWithPermissions('procurement.create')
  @Post()
  create(@Body() dto: CreateVendorRatingDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('supplierId') supplierId?: string,
    @Request() req?: any,
  ) {
    return this.service.findAll(facilityId, { supplierId }, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('summaries')
  getAllSummaries(@Request() req: any) {
    return this.service.getAllSummaries(req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('top')
  getTopVendors(@Query('limit') limit?: number, @Request() req?: any) {
    return this.service.getTopVendors(limit, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('summary/:supplierId')
  getSummary(@Param('supplierId') supplierId: string, @Request() req: any) {
    return this.service.getSummary(supplierId, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorRatingDto, @Request() req: any) {
    return this.service.update(id, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user?.tenantId);
  }
}
