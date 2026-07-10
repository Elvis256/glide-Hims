import { Controller, Get, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { CycleCountService } from './cycle-count.service';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('inventory/cycle-counts')
export class CycleCountController {
  constructor(private readonly cycleCountService: CycleCountService) {}

  @Post()
  @AuthWithPermissions('inventory.create')
  async createCycleCount(@Body() dto: any, @Request() req: any) {
    return this.cycleCountService.createCycleCount(dto, req.user?.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('inventory.read')
  async findAll(
    @Query('status') status?: string,
    @Query('facilityId') facilityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    return this.cycleCountService.findAll(
      {
        status,
        facilityId,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      },
      req?.user?.tenantId,
    );
  }

  @Get(':id')
  @AuthWithPermissions('inventory.read')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.cycleCountService.findOne(id, req.user?.tenantId);
  }

  @Post(':id/record')
  @AuthWithPermissions('inventory.create')
  async recordCount(
    @Param('id') cycleCountId: string,
    @Body() dto: { itemId: string; countedQuantity: number },
    @Request() req: any,
  ) {
    return this.cycleCountService.recordCount(
      cycleCountId,
      dto.itemId,
      dto.countedQuantity,
      req.user?.id,
      req.user?.tenantId,
    );
  }

  @Post(':id/items/:itemId/investigate')
  @AuthWithPermissions('inventory.create')
  async investigateVariance(
    @Param('id') cycleCountId: string,
    @Param('itemId') itemId: string,
    @Body() dto: { notes: string },
    @Request() req: any,
  ) {
    return this.cycleCountService.investigateVariance(
      cycleCountId,
      itemId,
      dto.notes,
      req.user?.tenantId,
    );
  }

  @Post(':id/complete')
  @AuthWithPermissions('inventory.create')
  async completeCycleCount(@Param('id') id: string, @Request() req: any) {
    return this.cycleCountService.completeCycleCount(id, req.user?.id, req.user?.tenantId);
  }

  @Post(':id/approve')
  @AuthWithPermissions('inventory.create')
  async approveCycleCount(@Param('id') id: string, @Request() req: any) {
    return this.cycleCountService.approveCycleCount(id, req.user?.id, req.user?.tenantId);
  }

  @Post(':id/apply-adjustments')
  @AuthWithPermissions('inventory.create')
  async applyAdjustments(@Param('id') id: string, @Request() req: any) {
    return this.cycleCountService.applyAdjustments(id, req.user?.id, req.user?.tenantId);
  }
}
