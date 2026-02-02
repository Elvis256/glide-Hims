import { Controller, Get, Post, Put, Body, Param, Query, Request } from '@nestjs/common';
import { VendorContractsService } from './vendor-contracts.service';
import { CreateVendorContractDto, UpdateVendorContractDto, CreateAmendmentDto, RenewContractDto } from './dto/vendor-contract.dto';
import { ContractStatus } from '../../database/entities/vendor-contract.entity';

@Controller('vendor-contracts')
export class VendorContractsController {
  constructor(private readonly service: VendorContractsService) {}

  @Post()
  create(@Body() dto: CreateVendorContractDto, @Request() req: any) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: ContractStatus,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.service.findAll(facilityId, { status, supplierId });
  }

  @Get('stats')
  getStats(@Query('facilityId') facilityId: string) {
    return this.service.getStats(facilityId);
  }

  @Get('expiring')
  getExpiring(@Query('facilityId') facilityId: string, @Query('daysAhead') daysAhead?: number) {
    return this.service.checkExpiringContracts(facilityId, daysAhead);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorContractDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewContractDto, @Request() req: any) {
    return this.service.renew(id, dto, req.user?.id || 'system');
  }

  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.service.terminate(id, body.reason);
  }

  @Post('amendments')
  addAmendment(@Body() dto: CreateAmendmentDto, @Request() req: any) {
    return this.service.addAmendment(dto, req.user?.id || 'system');
  }
}
