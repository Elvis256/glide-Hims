import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { BatchRecallService } from './batch-recall.service';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('inventory/recalls')
export class BatchRecallController {
  constructor(private readonly batchRecallService: BatchRecallService) {}

  @Post()
  @AuthWithPermissions('inventory.create')
  async initiateRecall(@Body() dto: any, @Request() req: any) {
    return this.batchRecallService.initiateRecall(dto, req.user?.id, req.user?.tenantId);
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
    return this.batchRecallService.findAll(
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
    return this.batchRecallService.findOne(id, req.user?.tenantId);
  }

  @Post(':id/quarantine')
  @AuthWithPermissions('inventory.create')
  async quarantineBatch(@Param('id') id: string, @Request() req: any) {
    return this.batchRecallService.quarantineBatch(id, req.user?.id, req.user?.tenantId);
  }

  @Get(':id/affected-patients')
  @AuthWithPermissions('inventory.read')
  async getAffectedPatients(@Param('id') id: string, @Request() req: any) {
    return this.batchRecallService.getAffectedPatients(id, req.user?.tenantId);
  }

  @Post(':id/complete')
  @AuthWithPermissions('inventory.create')
  async completeRecall(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.batchRecallService.completeRecall(
      id,
      req.user?.id,
      dto?.notes,
      req.user?.tenantId,
    );
  }
}
