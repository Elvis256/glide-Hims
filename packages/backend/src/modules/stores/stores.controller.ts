import {
  Controller, Get, Post, Patch, Body, Param, Query, Request, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto, CreateTransferDto, ApproveTransferDto, ReceiveTransferDto, AdjustStockDto, TransferStockDto } from './stores.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { TransferStatus } from '../../database/entities/store.entity';

@ApiTags('Stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly service: StoresService) {}

  // Inventory endpoints (must be before :id routes)
  @Get('inventory')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List pharmacy inventory' })
  getInventory(
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('storeId') storeId?: string,
    @Request() req?: any,
  ) {
    return this.service.getInventoryList({
      category,
      lowStock: lowStock === 'true',
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      storeId,
    }, req?.user?.tenantId);
  }

  @Get('inventory/low-stock')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get low stock items' })
  getLowStock(@Request() req: any) {
    return this.service.getLowStockItems(req.user?.tenantId);
  }

  @Get('inventory/expiring-soon')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get items expiring within specified days (default 90)' })
  getExpiringSoon(
    @Query('facilityId') facilityId?: string,
    @Query('days') days?: number,
    @Request() req?: any,
  ) {
    return this.service.getExpiringSoon(facilityId, days ? Number(days) : 90, req?.user?.tenantId);
  }

  @Get('inventory/categories/summary')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get inventory categories summary' })
  getCategorySummary(@Request() req: any) {
    return this.service.getCategorySummary(req.user?.tenantId);
  }

  @Get('inventory/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  getInventoryItem(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.getInventoryItem(id, req.user?.tenantId);
  }

  @Get('inventory/:id/movements')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get stock movements for an item' })
  getStockMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.service.getStockMovements(id, limit ? Number(limit) : 50, req?.user?.tenantId);
  }

  @Post('inventory/:id/adjust')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Adjust stock for an item' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @Request() req: any,
  ) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'] || req.tenantContext?.facilityId;
    if (!facilityId) {
      throw new BadRequestException('Facility ID is required for stock adjustment');
    }
    return this.service.adjustStock(id, dto, req.user.id, facilityId, req.user?.tenantId);
  }

  // Items (Drugs)
  @Get('items')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Search items/drugs' })
  searchItems(
    @Query('q') query?: string,
    @Query('isDrug') isDrug?: string,
    @Query('limit') limit?: number,
    @Query('storeId') storeId?: string,
    @Request() req?: any,
  ) {
    const isDrugBool = isDrug === 'true' ? true : isDrug === 'false' ? false : undefined;
    return this.service.searchItems(query, isDrugBool, limit, storeId, req?.user?.tenantId);
  }

  @Get('items/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get item by ID' })
  getItem(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.getItem(id, req.user?.tenantId);
  }

  @Get('movements')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List stock movements' })
  listMovements(
    @Query('itemId') itemId?: string,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.service.listMovements(itemId, limit || 50, req?.user?.tenantId);
  }

  @Post('inventory/:itemId/transfer')
  @AuthWithPermissions('stores.create')
  @ApiOperation({ summary: 'Transfer stock for an item between stores' })
  transferStock(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: TransferStockDto,
    @Request() req: any,
  ) {
    return this.service.transferStock(itemId, dto, req.user.id, req.user?.tenantId);
  }

  @Post()
  @AuthWithPermissions('stores.create')
  @ApiOperation({ summary: 'Create store/location' })
  createStore(@Body() dto: CreateStoreDto, @Request() req: any) {
    return this.service.createStore(dto, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List all stores' })
  findAllStores(@Query('facilityId') facilityId?: string, @Query('type') type?: string, @Request() req?: any) {
    return this.service.findAllStores(facilityId, type, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get store by ID' })
  findStore(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findStore(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Update store' })
  updateStore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreDto, @Request() req: any) {
    return this.service.updateStore(id, dto, req.user?.tenantId);
  }

  @Post('transfers')
  @AuthWithPermissions('stores.create')
  @ApiOperation({ summary: 'Create stock transfer request' })
  createTransfer(@Body() dto: CreateTransferDto, @Request() req: any) {
    return this.service.createTransfer(dto, req.user.id, req.user?.tenantId);
  }

  @Get('transfers/list')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List stock transfers' })
  findAllTransfers(
    @Query('storeId') storeId?: string,
    @Query('status') status?: TransferStatus,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.service.findAllTransfers(storeId, status, limit, req?.user?.tenantId);
  }

  @Get('transfers/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get transfer by ID' })
  findTransfer(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findTransfer(id, req.user?.tenantId);
  }

  @Post('transfers/:id/approve')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Approve and dispatch transfer' })
  approveTransfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveTransferDto, @Request() req: any) {
    return this.service.approveTransfer(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('transfers/:id/receive')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Receive stock transfer' })
  receiveTransfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveTransferDto, @Request() req: any) {
    return this.service.receiveTransfer(id, dto, req.user.id, req.user?.tenantId);
  }

  @Post('transfers/:id/cancel')
  @AuthWithPermissions('stores.delete')
  @ApiOperation({ summary: 'Cancel transfer' })
  cancelTransfer(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.cancelTransfer(id, req.user?.id, req.user?.tenantId);
  }
}
