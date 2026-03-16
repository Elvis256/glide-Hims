import { Controller, Get, Post, Put, Body, Param, Query, Request } from '@nestjs/common';
import { VendorContractsService } from './vendor-contracts.service';
import { CreateVendorContractDto, UpdateVendorContractDto, CreateAmendmentDto, RenewContractDto } from './dto/vendor-contract.dto';
import { ContractStatus } from '../../database/entities/vendor-contract.entity';

@Controller('vendor-contracts')
export class VendorContractsController {
  constructor(private readonly service: VendorContractsService) {}

  @Post()
  create(@Body() dto: CreateVendorContractDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: ContractStatus,
    @Query('supplierId') supplierId?: string,
    @Request() req?: any,
  ) {
    return this.service.findAll(facilityId, { status, supplierId }, req?.user?.tenantId);
  }

  @Get('stats')
  getStats(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.service.getStats(facilityId, req.user?.tenantId);
  }

  @Get('expiring')
  getExpiring(@Query('facilityId') facilityId: string, @Query('daysAhead') daysAhead?: number, @Request() req?: any) {
    return this.service.checkExpiringContracts(facilityId, daysAhead, req?.user?.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorContractDto, @Request() req: any) {
    return this.service.update(id, dto, req.user?.tenantId);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @Request() req: any) {
    return this.service.activate(id, req.user?.tenantId);
  }

  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewContractDto, @Request() req: any) {
    return this.service.renew(id, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: { reason: string }, @Request() req: any) {
    return this.service.terminate(id, body.reason, req.user?.tenantId);
  }

  @Post('amendments')
  addAmendment(@Body() dto: CreateAmendmentDto, @Request() req: any) {
    return this.service.addAmendment(dto, req.user?.id || 'system', req.user?.tenantId);
  }
}
