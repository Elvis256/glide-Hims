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
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { StockTransferService } from './stock-transfer.service';
import {
  CreateStockTransferDto,
  ApproveStockTransferDto,
  RejectStockTransferDto,
  ReceiveStockTransferDto,
  CancelStockTransferDto,
} from './dto/stock-transfer.dto';
import { TransferStatus } from '../../database/entities/stock-transfer.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('stock-transfers')
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Post()
  @AuthWithPermissions('stock-transfer.create')
  async create(@Body() dto: CreateStockTransferDto, @Request() req: any) {
    return this.stockTransferService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get('dashboard')
  @AuthWithPermissions('stock-transfer.read')
  async getDashboard(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.stockTransferService.getDashboard(req?.user?.tenantId, facilityId);
  }

  @Get()
  @AuthWithPermissions('stock-transfer.read')
  async findAll(
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: TransferStatus,
    @Query('direction') direction?: 'incoming' | 'outgoing',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    return this.stockTransferService.findAll(req?.user?.tenantId, facilityId, {
      status,
      direction,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  @AuthWithPermissions('stock-transfer.read')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.stockTransferService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id/approve')
  @AuthWithPermissions('stock-transfer.approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveStockTransferDto,
    @Request() req: any,
  ) {
    return this.stockTransferService.approve(id, req.user.id, req.user?.tenantId, dto);
  }

  @Patch(':id/reject')
  @AuthWithPermissions('stock-transfer.approve')
  async reject(@Param('id') id: string, @Body() dto: RejectStockTransferDto, @Request() req: any) {
    return this.stockTransferService.reject(id, req.user.id, req.user?.tenantId, dto);
  }

  @Patch(':id/ship')
  @AuthWithPermissions('stock-transfer.ship')
  async ship(@Param('id') id: string, @Request() req: any) {
    return this.stockTransferService.ship(id, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/receive')
  @AuthWithPermissions('stock-transfer.receive')
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
    @Request() req: any,
  ) {
    return this.stockTransferService.receive(id, req.user.id, req.user?.tenantId, dto);
  }

  @Patch(':id/cancel')
  @AuthWithPermissions('stock-transfer.create')
  async cancel(@Param('id') id: string, @Body() dto: CancelStockTransferDto, @Request() req: any) {
    return this.stockTransferService.cancel(id, req.user.id, req.user?.tenantId, dto);
  }
}
