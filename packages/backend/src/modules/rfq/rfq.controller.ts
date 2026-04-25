import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RFQService } from './rfq.service';
import {
  CreateRFQDto,
  UpdateRFQDto,
  AddVendorsDto,
  CreateQuotationDto,
  ApproveQuotationDto,
  RejectQuotationDto,
  SelectWinnerDto,
} from './dto/rfq.dto';
import { RFQStatus, ApprovalLevel } from '../../database/entities/rfq.entity';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('rfq')
export class RFQController {
  constructor(private readonly rfqService: RFQService) {}

  // --- Static/literal routes MUST come before dynamic :id routes ---

  @AuthWithPermissions('procurement.create')
  @Post()
  create(@Body() dto: CreateRFQDto, @Request() req: any) {
    return this.rfqService.create(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get()
  findAll(
    @Query('facilityId') facilityId: string,
    @Query('status') status?: RFQStatus,
    @Request() req?: any,
  ) {
    return this.rfqService.findAll(facilityId, { status }, req?.user?.tenantId);
  }

  // Quotations (literal paths before :id)
  @AuthWithPermissions('procurement.create')
  @Post('quotations')
  receiveQuotation(@Body() dto: CreateQuotationDto, @Request() req: any) {
    return this.rfqService.receiveQuotation(dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get('quotations/:id')
  getQuotation(@Param('id') id: string, @Request() req: any) {
    return this.rfqService.getQuotation(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.approve')
  @Post('quotations/:id/select')
  selectWinner(@Param('id') quotationId: string, @Request() req: any) {
    return this.rfqService.selectWinner(quotationId, req.user?.id || 'system', req.user?.tenantId);
  }

  // Approvals (literal paths before :id)
  @AuthWithPermissions('procurement.read')
  @Get('approvals/pending')
  getPendingApprovals(
    @Query('facilityId') facilityId: string,
    @Query('level') level?: ApprovalLevel,
    @Request() req?: any,
  ) {
    return this.rfqService.getPendingApprovals(facilityId, level, req?.user?.tenantId);
  }

  @AuthWithPermissions('procurement.approve')
  @Post('approvals/:id/approve')
  approveQuotation(@Param('id') id: string, @Body() dto: ApproveQuotationDto, @Request() req: any) {
    return this.rfqService.approveQuotation(id, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.approve')
  @Post('approvals/:id/reject')
  rejectQuotation(@Param('id') id: string, @Body() dto: RejectQuotationDto, @Request() req: any) {
    return this.rfqService.rejectQuotation(id, dto, req.user?.id || 'system', req.user?.tenantId);
  }

  // --- Dynamic :id routes AFTER all literal routes ---

  @AuthWithPermissions('procurement.read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.rfqService.findOne(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.update')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRFQDto, @Request() req: any) {
    return this.rfqService.update(id, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/vendors')
  addVendors(@Param('id') id: string, @Body() dto: AddVendorsDto, @Request() req: any) {
    return this.rfqService.addVendors(id, dto, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/send')
  sendToVendors(@Param('id') id: string, @Request() req: any) {
    return this.rfqService.sendToVendors(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.create')
  @Post(':id/close')
  closeRFQ(@Param('id') id: string, @Request() req: any) {
    return this.rfqService.closeRFQ(id, req.user?.tenantId);
  }

  @AuthWithPermissions('procurement.read')
  @Get(':id/quotations')
  getQuotations(@Param('id') rfqId: string, @Request() req: any) {
    return this.rfqService.getQuotationsForRFQ(rfqId, req.user?.tenantId);
  }
}
