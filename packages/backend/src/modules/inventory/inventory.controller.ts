import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { InventoryService } from './inventory.service';
import {
  CreateItemDto,
  UpdateItemDto,
  StockReceiveDto,
  StockAdjustmentDto,
  StockTransferDto,
} from './dto/inventory.dto';
import { MovementType } from '../../database/entities/inventory.entity';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@UseGuards(ModuleGuard)
@RequireModule('stores')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ============ ITEMS ============

  @Post('items')
  @AuthWithPermissions('inventory.create')
  async createItem(@Body() dto: CreateItemDto, @Request() req: any) {
    return this.inventoryService.createItem(dto, req.user?.tenantId);
  }

  @Get('items')
  @AuthWithPermissions('inventory.read')
  async findAllItems(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isDrug') isDrug?: string,
    @Query('status') status?: string,
    @Request() req?: any,
  ) {
    return this.inventoryService.findAllItems({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      category,
      isDrug: isDrug ? isDrug === 'true' : undefined,
      status,
      tenantId: req?.user?.tenantId,
    });
  }

  @Get('items/:id')
  @AuthWithPermissions('inventory.read')
  async findItemById(@Param('id') id: string, @Request() req: any) {
    return this.inventoryService.findItemById(id, req.user?.tenantId);
  }

  @Put('items/:id')
  @AuthWithPermissions('inventory.update')
  async updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto, @Request() req: any) {
    return this.inventoryService.updateItem(id, dto, req.user?.tenantId);
  }

  @Delete('items/:id')
  @AuthWithPermissions('inventory.delete')
  async deleteItem(@Param('id') id: string, @Request() req: any) {
    await this.inventoryService.deleteItem(id, req.user?.tenantId);
    return { message: 'Item deleted successfully' };
  }

  // ============ STOCK ============

  @Get('stock')
  @AuthWithPermissions('inventory.read')
  async getStockBalances(
    @Query('facilityId') facilityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
    @Request() req?: any,
  ) {
    return this.inventoryService.getStockBalances({
      facilityId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      lowStock: lowStock === 'true',
      tenantId: req?.user?.tenantId,
    });
  }

  @Get('stock/:itemId/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getStockBalance(
    @Param('itemId') itemId: string,
    @Param('facilityId') facilityId: string,
    @Request() req: any,
  ) {
    const balance = await this.inventoryService.getStockBalance(
      itemId,
      facilityId,
      req.user?.tenantId,
    );
    return balance || { totalQuantity: 0, availableQuantity: 0, reservedQuantity: 0 };
  }

  @Post('stock/receive')
  @AuthWithPermissions('inventory.create')
  async receiveStock(@Body() dto: StockReceiveDto, @Request() req: any) {
    return this.inventoryService.receiveStock(dto, req.user.id, req.user?.tenantId);
  }

  @Post('stock/adjust')
  @AuthWithPermissions('inventory.adjust')
  async adjustStock(@Body() dto: StockAdjustmentDto, @Request() req: any) {
    return this.inventoryService.adjustStock(dto, req.user.id, req.user?.tenantId);
  }

  @Post('stock/transfer')
  @AuthWithPermissions('inventory.transfer')
  async transferStock(@Body() dto: StockTransferDto, @Request() req: any) {
    return this.inventoryService.transferStock(dto, req.user.id, req.user?.tenantId);
  }

  // ============ REPORTS ============

  @Get('movements')
  @AuthWithPermissions('inventory.read')
  async getStockMovements(
    @Query('facilityId') facilityId: string,
    @Query('itemId') itemId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('movementType') movementType?: MovementType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    return this.inventoryService.getStockMovements({
      facilityId,
      itemId,
      startDate,
      endDate,
      movementType,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      tenantId: req?.user?.tenantId,
    });
  }

  @Get('low-stock/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getLowStockItems(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.inventoryService.getLowStockItems(facilityId, req.user?.tenantId);
  }

  @Get('expiring/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getExpiringItems(
    @Param('facilityId') facilityId: string,
    @Query('days') days?: string,
    @Request() req?: any,
  ) {
    return this.inventoryService.getExpiringItems(
      facilityId,
      days ? parseInt(days) : 90,
      req?.user?.tenantId,
    );
  }

  @Get('consumption')
  @AuthWithPermissions('inventory.read')
  async getConsumptionReport(
    @Request() req: any,
    @Query('period') period: string = 'month',
    @Query('department') department?: string,
    @Query('category') category?: string,
  ) {
    return this.inventoryService.getConsumptionReport(
      req.user?.tenantId,
      period,
      department,
      category,
    );
  }

  @Get('expired/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getExpiredItems(@Param('facilityId') facilityId: string, @Request() req: any) {
    return this.inventoryService.getExpiredItems(facilityId, req.user?.tenantId);
  }
}
