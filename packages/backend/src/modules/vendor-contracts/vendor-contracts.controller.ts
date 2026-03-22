import { Controller, Get, Post, Put, Body, Param, Query, Request } from '@nestjs/common';
import { VendorContractsService } from './vendor-contracts.service';
import { CreateVendorContractDto, UpdateVendorContractDto, CreateAmendmentDto, RenewContractDto, TerminateContractDto } from './dto/vendor-contract.dto';
import { ContractStatus } from '../../database/entities/vendor-contract.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@Controller('vendor-contracts')
export class VendorContractsController {
  constructor(private readonly service: VendorContractsService) {}

  @AuthWithPermissions('procurement.create')
  @Post()
  create(@Body() dto: CreateVendorContractDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: ContractStatus,
    @Query('supplierId') supplierId?: string,
    @Request() req?: any,
  ) {
    return this.service.findAll(facilityId, { status, supplierId }, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('stats')
  getStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.service.getStats(facilityId, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('expiring')
  getExpiring(@Query('facilityId') facilityId: string, @Query('daysAhead') daysAhead?: number, @Request() req?: any) {
    return this.service.checkExpiringContracts(facilityId, daysAhead, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorContractDto, @Request() req: any) {
    return this.service.update(id, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/activate')
  activate(@Param('id') id: string, @Request() req: any) {
    return this.service.activate(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewContractDto, @Request() req: any) {
    return this.service.renew(id, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: TerminateContractDto, @Request() req: any) {
    return this.service.terminate(id, body.reason, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post('amendments')
  addAmendment(@Body() dto: CreateAmendmentDto, @Request() req: any) {
    return this.service.addAmendment(dto, req.user?.id || 'system', req.user?.tenantId);
  }
}
