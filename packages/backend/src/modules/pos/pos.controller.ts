import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { PosService } from './pos.service';
import { PosMomoService } from './pos-momo.service';
import { InitiateMomoPaymentDto } from './pos-momo.dto';
import {
  CreateRegisterDto,
  UpdateRegisterDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateWholesaleCustomerDto,
  UpdateWholesaleCustomerDto,
  CreatePricingTierDto,
  CreateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './pos.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('pos')
@Controller('pos')
export class PosController {
  constructor(
    private readonly service: PosService,
    private readonly momoService: PosMomoService,
  ) {}

  // ─── Registers ─────────────────────────────────────────────────────────────

  @Post('registers')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'Create a POS register' })
  createRegister(@Body() dto: CreateRegisterDto, @Request() req: any) {
    return this.service.createRegister(dto, req.user?.tenantId);
  }

  @Get('registers')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'List all POS registers' })
  findAllRegisters(@Request() req: any) {
    return this.service.findAllRegisters(req.user?.tenantId);
  }

  @Patch('registers/:id')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'Update a POS register' })
  updateRegister(@Param('id') id: string, @Body() dto: UpdateRegisterDto, @Request() req: any) {
    return this.service.updateRegister(id, dto, req.user?.tenantId);
  }

  // ─── Shifts ────────────────────────────────────────────────────────────────

  @Post('shifts/open')
  @AuthWithPermissions('pos.shift')
  @ApiOperation({ summary: 'Open a cashier shift' })
  openShift(@Body() dto: OpenShiftDto, @Request() req: any) {
    return this.service.openShift(dto, req.user.id, req.user?.tenantId);
  }

  @Post('shifts/close')
  @AuthWithPermissions('pos.shift')
  @ApiOperation({ summary: 'Close the current open shift' })
  closeShift(@Body() dto: CloseShiftDto, @Request() req: any) {
    return this.service.closeShift(dto, req.user.id, req.user?.tenantId);
  }

  @Get('shifts/current')
  @AuthWithPermissions('pos.shift')
  @ApiOperation({ summary: 'Get current open shift for the logged-in cashier' })
  getCurrentShift(@Request() req: any) {
    return this.service.getCurrentShift(req.user.id, req.user?.tenantId);
  }

  @Get('shifts')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'List shift history' })
  getShiftHistory(@Request() req: any, @Query('registerId') registerId?: string) {
    return this.service.getShiftHistory(req.user?.tenantId, registerId);
  }

  @Get('shifts/:id/report')
  @AuthWithPermissions('pos.manage')
  @ApiOperation({ summary: 'Get detailed shift report with payment breakdown' })
  getShiftReport(@Param('id') id: string, @Request() req: any) {
    return this.service.getShiftReport(id, req.user?.tenantId);
  }

  // ─── Wholesale Customers ──────────────────────────────────────────────────

  @Post('wholesale/customers')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Create a wholesale customer' })
  createCustomer(@Body() dto: CreateWholesaleCustomerDto, @Request() req: any) {
    return this.service.createCustomer(dto, req.user?.tenantId);
  }

  @Get('wholesale/customers')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'List wholesale customers' })
  findAllCustomers(@Request() req: any) {
    return this.service.findAllCustomers(req.user?.tenantId);
  }

  @Get('wholesale/customers/:id')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Get wholesale customer details with balance' })
  findCustomer(@Param('id') id: string, @Request() req: any) {
    return this.service.getCustomerBalance(id, req.user?.tenantId);
  }

  @Patch('wholesale/customers/:id')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Update a wholesale customer' })
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateWholesaleCustomerDto,
    @Request() req: any,
  ) {
    return this.service.updateCustomer(id, dto, req.user?.tenantId);
  }

  // ─── Pricing Tiers ────────────────────────────────────────────────────────

  @Post('wholesale/tiers')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Create a pricing tier' })
  createTier(@Body() dto: CreatePricingTierDto, @Request() req: any) {
    return this.service.createTier(dto, req.user?.tenantId);
  }

  @Get('wholesale/tiers')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'List pricing tiers' })
  findAllTiers(@Request() req: any) {
    return this.service.findAllTiers(req.user?.tenantId);
  }

  // ─── Deliveries ───────────────────────────────────────────────────────────

  @Post('deliveries')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Create a delivery' })
  createDelivery(@Body() dto: CreateDeliveryDto, @Request() req: any) {
    return this.service.createDelivery(dto, req.user?.tenantId);
  }

  @Patch('deliveries/:id/status')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'Update delivery status' })
  updateDeliveryStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Request() req: any,
  ) {
    return this.service.updateDeliveryStatus(id, dto, req.user?.tenantId);
  }

  @Get('deliveries')
  @AuthWithPermissions('wholesale.manage')
  @ApiOperation({ summary: 'List deliveries' })
  findAllDeliveries(@Request() req: any, @Query('status') status?: string) {
    return this.service.findAllDeliveries(req.user?.tenantId, status);
  }

  // ─── D1: Mobile Money ──────────────────────────────────────────────────────

  @Post('sales/:id/mobile-money')
  @AuthWithPermissions('pos.payment.mobile_money')
  @ApiOperation({ summary: 'Initiate Mobile Money STK push for a POS sale' })
  initiateMoMo(@Param('id') id: string, @Body() dto: InitiateMomoPaymentDto, @Request() req: any) {
    return this.momoService.initiate(id, dto, req.user.id, req.user.tenantId);
  }

  @Get('sales/mobile-money/:transactionId/status')
  @AuthWithPermissions('pos.payment.mobile_money')
  @ApiOperation({ summary: 'Poll Mobile Money transaction status' })
  getMoMoStatus(@Param('transactionId') txId: string, @Request() req: any) {
    return this.momoService.getStatus(txId, req.user.id, req.user.tenantId);
  }

  @Post('sales/mobile-money/:transactionId/cancel')
  @AuthWithPermissions('pos.payment.mobile_money')
  @ApiOperation({ summary: 'Cancel a pending Mobile Money transaction' })
  cancelMoMo(@Param('transactionId') txId: string, @Request() req: any) {
    return this.momoService.cancel(txId, req.user.id, req.user.tenantId);
  }
}
