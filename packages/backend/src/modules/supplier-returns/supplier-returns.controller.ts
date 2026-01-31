import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SupplierReturnsService } from './supplier-returns.service';
import { CreateSupplierReturnDto, UpdateSupplierReturnDto, SupplierReturnQueryDto } from './supplier-returns.dto';
import { ReturnStatus } from '../../database/entities/supplier-return.entity';

@Controller('supplier-returns')
export class SupplierReturnsController {
  constructor(private readonly supplierReturnsService: SupplierReturnsService) {}

  @Post()
  @AuthWithPermissions('supplier-returns.create')
  async create(@Body() dto: CreateSupplierReturnDto, @Request() req: any) {
    return this.supplierReturnsService.create(dto, req.user.id);
  }

  @Get()
  @AuthWithPermissions('supplier-returns.read')
  async findAll(@Query() query: SupplierReturnQueryDto) {
    return this.supplierReturnsService.findAll(query);
  }

  @Get('facility/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async findByFacility(@Param('facilityId') facilityId: string) {
    return this.supplierReturnsService.findByFacility(facilityId);
  }

  @Get('stats/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getStats(@Param('facilityId') facilityId: string) {
    return this.supplierReturnsService.getStats(facilityId);
  }

  @Get('summary/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getSummary(@Param('facilityId') facilityId: string) {
    return this.supplierReturnsService.getSummary(facilityId);
  }

  @Get('supplier/:supplierId/facility/:facilityId')
  @AuthWithPermissions('supplier-returns.read')
  async getBySupplier(
    @Param('supplierId') supplierId: string,
    @Param('facilityId') facilityId: string,
  ) {
    return this.supplierReturnsService.getBySupplier(supplierId, facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('supplier-returns.read')
  async findOne(@Param('id') id: string) {
    return this.supplierReturnsService.findOne(id);
  }

  @Put(':id')
  @AuthWithPermissions('supplier-returns.update')
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierReturnDto) {
    return this.supplierReturnsService.update(id, dto);
  }

  @Put(':id/status/:status')
  @AuthWithPermissions('supplier-returns.update')
  async updateStatus(
    @Param('id') id: string,
    @Param('status') status: ReturnStatus,
    @Request() req: any,
  ) {
    return this.supplierReturnsService.updateStatus(id, status, req.user.id);
  }
}
