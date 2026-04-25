import { Controller, Get, Post, Put, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DisposalService } from './disposal.service';
import { CreateDisposalDto, UpdateDisposalDto, DisposalQueryDto } from './disposal.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('disposal')
export class DisposalController {
  constructor(private readonly disposalService: DisposalService) {}

  @Post()
  @AuthWithPermissions('disposal.create')
  async create(@Body() dto: CreateDisposalDto, @Request() req: any) {
    return this.disposalService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('disposal.read')
  async findAll(@Query() query: DisposalQueryDto, @Request() req: any) {
    return this.disposalService.findAll(query, req.user?.tenantId);
  }

  @Get('facility/:facilityId')
  @AuthWithPermissions('disposal.read')
  async findByFacility(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.disposalService.findByFacility(facilityId, req.user?.tenantId);
  }

  @Get('stats/:facilityId')
  @AuthWithPermissions('disposal.read')
  async getStats(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
  ) {
    return this.disposalService.getStats(
      facilityId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      req?.user?.tenantId,
    );
  }

  @Get('summary/:facilityId')
  @AuthWithPermissions('disposal.read')
  async getSummary(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.disposalService.getSummary(facilityId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('disposal.read')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.disposalService.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('disposal.update')
  async update(@Param('id') id: string, @Body() dto: UpdateDisposalDto, @Request() req: any) {
    return this.disposalService.update(id, dto, req.user?.tenantId);
  }

  @Put(':id/approve')
  @AuthWithPermissions('disposal.approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.disposalService.approve(id, req.user.id, req.user?.tenantId);
  }
}
