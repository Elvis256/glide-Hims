import { Controller, Get, Post, Put, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SupplierReturnsService } from './supplier-returns.service';
import {
  CreateSupplierReturnDto,
  UpdateSupplierReturnDto,
  SupplierReturnQueryDto,
} from './supplier-returns.dto';
import { ReturnStatus } from '../../database/entities/supplier-return.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('supplier-returns')
export class SupplierReturnsController {
  constructor(private readonly supplierReturnsService: SupplierReturnsService) {}

  @Post()
  @AuthWithPermissions('supplier-returns.create')
  async create(@Body() dto: CreateSupplierReturnDto, @Request() req: any) {
    return this.supplierReturnsService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('supplier-returns.read')
  async findAll(@Query() query: SupplierReturnQueryDto, @Request() req: any) {
    return this.supplierReturnsService.findAll(query, req.user?.tenantId);
  }

  @Get('facility/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async findByFacility(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.supplierReturnsService.findByFacility(facilityId, req.user?.tenantId);
  }

  @Get('stats/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getStats(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.supplierReturnsService.getStats(facilityId, req.user?.tenantId);
  }

  @Get('summary/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getSummary(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.supplierReturnsService.getSummary(facilityId, req.user?.tenantId);
  }

  @Get('supplier/:supplierId/facility/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getBySupplier(
    @Param('supplierId') supplierId: string,
    @Param('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    return this.supplierReturnsService.getBySupplier(supplierId, facilityId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('supplier-returns.read')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.supplierReturnsService.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('supplier-returns.update')
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierReturnDto, @Request() req: any) {
    return this.supplierReturnsService.update(id, dto, req.user?.tenantId);
  }

  @Put(':id/status/:status')
  @AuthWithPermissions('supplier-returns.update')
  async updateStatus(
    @Param('id') id: string,
    @Param('status') status: ReturnStatus,
    @Request() req: any,
  ) {
    return this.supplierReturnsService.updateStatus(id, status, req.user.id, req.user?.tenantId);
  }
}
