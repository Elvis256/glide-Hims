import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { RFQService } from './rfq.service';
import { CreateRFQDto, UpdateRFQDto, AddVendorsDto, CreateQuotationDto, ApproveQuotationDto, RejectQuotationDto, SelectWinnerDto } from './dto/rfq.dto';
import { RFQStatus, ApprovalLevel } from '../../database/entities/rfq.entity';

@Controller('rfq')
export class RFQController {
  constructor(private readonly rfqService: RFQService) {}

  @Post()
  create(@Body() dto: CreateRFQDto, @Request() req: any) {
    return this.rfqService.create(dto, req.user?.id || 'system');
  }

  @Get()
  findAll(@Query('facilityId') facilityId: string, @Query('status') status?: RFQStatus) {
    return this.rfqService.findAll(facilityId, { status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rfqService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRFQDto) {
    return this.rfqService.update(id, dto);
  }

  @Post(':id/vendors')
  addVendors(@Param('id') id: string, @Body() dto: AddVendorsDto) {
    return this.rfqService.addVendors(id, dto);
  }

  @Post(':id/send')
  sendToVendors(@Param('id') id: string) {
    return this.rfqService.sendToVendors(id);
  }

  @Post(':id/close')
  closeRFQ(@Param('id') id: string) {
    return this.rfqService.closeRFQ(id);
  }

  // Quotations
  @Post('quotations')
  receiveQuotation(@Body() dto: CreateQuotationDto, @Request() req: any) {
    return this.rfqService.receiveQuotation(dto, req.user?.id || 'system');
  }

  @Get(':id/quotations')
  getQuotations(@Param('id') rfqId: string) {
    return this.rfqService.getQuotationsForRFQ(rfqId);
  }

  @Get('quotations/:id')
  getQuotation(@Param('id') id: string) {
    return this.rfqService.getQuotation(id);
  }

  @Post('quotations/:id/select')
  selectWinner(@Param('id') quotationId: string, @Request() req: any) {
    return this.rfqService.selectWinner(quotationId, req.user?.id || 'system');
  }

  // Approvals
  @Get('approvals/pending')
  getPendingApprovals(@Query('facilityId') facilityId: string, @Query('level') level?: ApprovalLevel) {
    return this.rfqService.getPendingApprovals(facilityId, level);
  }

  @Post('approvals/:id/approve')
  approveQuotation(@Param('id') id: string, @Body() dto: ApproveQuotationDto, @Request() req: any) {
    return this.rfqService.approveQuotation(id, dto, req.user?.id || 'system');
  }

  @Post('approvals/:id/reject')
  rejectQuotation(@Param('id') id: string, @Body() dto: RejectQuotationDto, @Request() req: any) {
    return this.rfqService.rejectQuotation(id, dto, req.user?.id || 'system');
  }
}
