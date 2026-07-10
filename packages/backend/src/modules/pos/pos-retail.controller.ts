import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PosRetailService } from './pos-retail.service';
import {
  CreateReturnDto,
  VoidSaleDto,
  HoldSaleDto,
  ApplyDiscountDto,
  UpsertQuickKeyDto,
  SetManagerPinDto,
  ReceiptHistoryQueryDto,
  UpdateRetailCustomerDto,
} from './pos-retail.dto';

@ApiTags('POS Retail')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pos')
@Controller('pos')
export class PosRetailController {
  constructor(private readonly service: PosRetailService) {}

  // ─── B1: Returns ──────────────────────────────────────────────────────────

  @Post('returns')
  @AuthWithPermissions('pos.return.create')
  @ApiOperation({ summary: 'Create a pharmacy return/refund' })
  createReturn(@Body() dto: CreateReturnDto, @Request() req: any) {
    return this.service.createReturn(dto, req.user.id, req.user.tenantId);
  }

  @Get('returns')
  @AuthWithPermissions('pos.return.read')
  @ApiOperation({ summary: 'List returns/refunds' })
  listReturns(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('saleId') saleId?: string,
  ) {
    return this.service.listReturns(req.user.tenantId, { from, to, saleId });
  }

  @Get('returns/:id')
  @AuthWithPermissions('pos.return.read')
  @ApiOperation({ summary: 'Get a return by ID' })
  getReturn(@Param('id') id: string, @Request() req: any) {
    return this.service.getReturn(id, req.user.tenantId);
  }

  // ─── B2: Void ─────────────────────────────────────────────────────────────

  @Post('sales/:id/void')
  @AuthWithPermissions('pos.sale.void')
  @ApiOperation({ summary: 'Void a completed sale (manager PIN required)' })
  voidSale(@Param('id') id: string, @Body() dto: VoidSaleDto, @Request() req: any) {
    return this.service.voidSale(id, dto, req.user.id, req.user.tenantId);
  }

  @Post('settings/manager-pin')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'Set or update the manager PIN for this facility' })
  setManagerPin(@Body() dto: SetManagerPinDto, @Request() req: any) {
    return this.service.setManagerPin(dto.pin, req.user.tenantId).then(() => ({ ok: true }));
  }

  // ─── B3: Hold / Park ──────────────────────────────────────────────────────

  @Post('sales/hold')
  @AuthWithPermissions('pos.sale.hold')
  @ApiOperation({ summary: 'Park/hold a cart for later' })
  holdSale(@Body() dto: HoldSaleDto, @Request() req: any) {
    return this.service.holdSale(dto, req.user.id, req.user.tenantId);
  }

  @Get('sales/held')
  @AuthWithPermissions('pos.sale.hold')
  @ApiOperation({ summary: 'List held/parked sales for current register/shift' })
  listHeldSales(
    @Request() req: any,
    @Query('registerId') registerId?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.service.listHeldSales(req.user.tenantId, registerId, shiftId);
  }

  @Post('sales/recall/:id')
  @AuthWithPermissions('pos.sale.hold')
  @ApiOperation({ summary: 'Recall a held/parked sale (deletes hold, returns cart)' })
  recallHeldSale(@Param('id') id: string, @Request() req: any) {
    return this.service.recallHeldSale(id, req.user.tenantId);
  }

  @Delete('sales/held/:id')
  @AuthWithPermissions('pos.sale.hold')
  @ApiOperation({ summary: 'Delete a held sale' })
  deleteHeldSale(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteHeldSale(id, req.user.tenantId).then(() => ({ ok: true }));
  }

  // ─── B4: Discounts ────────────────────────────────────────────────────────

  @Post('discounts')
  @AuthWithPermissions('pos.discount.line')
  @ApiOperation({ summary: 'Apply a line or cart discount (PIN required if above threshold)' })
  applyDiscount(@Body() dto: ApplyDiscountDto, @Request() req: any) {
    return this.service.applyDiscount(dto, req.user.id, req.user.tenantId);
  }

  // ─── B7: Quick Keys ───────────────────────────────────────────────────────

  @Get('quick-keys')
  @AuthWithPermissions('pos.shift')
  @ApiOperation({ summary: 'List quick keys for a register' })
  listQuickKeys(@Request() req: any, @Query('registerId') registerId?: string) {
    return this.service.listQuickKeys(req.user.tenantId, registerId);
  }

  @Post('quick-keys')
  @AuthWithPermissions('pos.quickkey.manage')
  @ApiOperation({ summary: 'Create or update a quick key' })
  upsertQuickKey(@Body() dto: UpsertQuickKeyDto, @Request() req: any) {
    return this.service.upsertQuickKey(dto, req.user.id, req.user.tenantId);
  }

  @Delete('quick-keys/:id')
  @AuthWithPermissions('pos.quickkey.manage')
  @ApiOperation({ summary: 'Delete a quick key' })
  deleteQuickKey(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteQuickKey(id, req.user.tenantId).then(() => ({ ok: true }));
  }

  // ─── B8: Retail Customers ─────────────────────────────────────────────────

  @Get('retail-customers/by-phone/:phone')
  @AuthWithPermissions('pos.customer.read')
  @ApiOperation({ summary: 'Get retail customer by phone + last 10 sales' })
  getCustomerByPhone(@Param('phone') phone: string, @Request() req: any) {
    return this.service.getCustomerByPhone(phone, req.user.tenantId);
  }

  // ─── C1: Patient link ─────────────────────────────────────────────────────

  @Get('patients/:id/recent-purchases')
  @AuthWithPermissions('pos.patient.link')
  @ApiOperation({ summary: 'Get recent pharmacy purchases for a linked patient' })
  patientRecentPurchases(
    @Param('id') patientId: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;
    return this.service.getPatientRecentPurchases(patientId, req.user.tenantId, parsedLimit);
  }
}
