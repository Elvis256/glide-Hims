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

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ============ ITEMS ============

  @Post('items')
  @AuthWithPermissions('inventory.create')
  async createItem(@Body() dto: CreateItemDto) {
    return this.inventoryService.createItem(dto);
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
  ) {
    return this.inventoryService.findAllItems({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      category,
      isDrug: isDrug ? isDrug === 'true' : undefined,
      status,
    });
  }

  @Get('items/:id')
  @AuthWithPermissions('inventory.read')
  async findItemById(@Param('id') id: string) {
    return this.inventoryService.findItemById(id);
  }

  @Put('items/:id')
  @AuthWithPermissions('inventory.update')
  async updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @AuthWithPermissions('inventory.delete')
  async deleteItem(@Param('id') id: string) {
    await this.inventoryService.deleteItem(id);
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
  ) {
    return this.inventoryService.getStockBalances({
      facilityId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      lowStock: lowStock === 'true',
    });
  }

  @Get('stock/:itemId/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getStockBalance(
    @Param('itemId') itemId: string,
    @Param('facilityId') facilityId: string,
  ) {
    const balance = await this.inventoryService.getStockBalance(itemId, facilityId);
    return balance || { totalQuantity: 0, availableQuantity: 0, reservedQuantity: 0 };
  }

  @Post('stock/receive')
  @AuthWithPermissions('inventory.create')
  async receiveStock(@Body() dto: StockReceiveDto, @Request() req: any) {
    return this.inventoryService.receiveStock(dto, req.user.id);
  }

  @Post('stock/adjust')
  @AuthWithPermissions('inventory.update')
  async adjustStock(@Body() dto: StockAdjustmentDto, @Request() req: any) {
    return this.inventoryService.adjustStock(dto, req.user.id);
  }

  @Post('stock/transfer')
  @AuthWithPermissions('inventory.create')
  async transferStock(@Body() dto: StockTransferDto, @Request() req: any) {
    return this.inventoryService.transferStock(dto, req.user.id);
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
  ) {
    return this.inventoryService.getStockMovements({
      facilityId,
      itemId,
      startDate,
      endDate,
      movementType,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('low-stock/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getLowStockItems(@Param('facilityId') facilityId: string) {
    return this.inventoryService.getLowStockItems(facilityId);
  }

  @Get('expiring/:facilityId')
  @AuthWithPermissions('inventory.read')
  async getExpiringItems(
    @Param('facilityId') facilityId: string,
    @Query('days') days?: string,
  ) {
    return this.inventoryService.getExpiringItems(
      facilityId,
      days ? parseInt(days) : 90,
    );
  }
}
