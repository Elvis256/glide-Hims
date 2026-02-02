import {
  Controller, Get, Post, Patch, Body, Param, Query, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto, CreateTransferDto, ApproveTransferDto, ReceiveTransferDto } from './stores.dto';
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
  ) {
    return this.service.getInventoryList({
      category,
      lowStock: lowStock === 'true',
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('inventory/low-stock')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get low stock items' })
  getLowStock() {
    return this.service.getLowStockItems();
  }

  @Get('inventory/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  getInventoryItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getInventoryItem(id);
  }

  @Get('inventory/:id/movements')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get stock movements for an item' })
  getStockMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.getStockMovements(id, limit ? Number(limit) : 50);
  }

  @Post('inventory/:id/adjust')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Adjust stock for an item' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { 
      quantity: number; 
      type: 'in' | 'out' | 'adjustment'; 
      reason: string;
      batchNumber?: string;
      expiryDate?: string;
      reference?: string;
    },
    @Request() req: any,
  ) {
    // Use first facility for now - in production would get from user context
    const facilityId = 'c02ac4ff-f644-4040-afd3-d538311f9965';
    return this.service.adjustStock(id, dto, req.user.id, facilityId);
  }

  // Items (Drugs)
  @Get('items')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Search items/drugs' })
  searchItems(
    @Query('q') query?: string,
    @Query('isDrug') isDrug?: string,
    @Query('limit') limit?: number,
  ) {
    const isDrugBool = isDrug === 'true' ? true : isDrug === 'false' ? false : undefined;
    return this.service.searchItems(query, isDrugBool, limit);
  }

  @Get('items/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get item by ID' })
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getItem(id);
  }

  @Post()
  @AuthWithPermissions('stores.create')
  @ApiOperation({ summary: 'Create store/location' })
  createStore(@Body() dto: CreateStoreDto) {
    return this.service.createStore(dto);
  }

  @Get()
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List all stores' })
  findAllStores(@Query('facilityId') facilityId?: string, @Query('type') type?: string) {
    return this.service.findAllStores(facilityId, type);
  }

  @Get(':id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get store by ID' })
  findStore(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findStore(id);
  }

  @Patch(':id')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Update store' })
  updateStore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreDto) {
    return this.service.updateStore(id, dto);
  }

  @Post('transfers')
  @AuthWithPermissions('stores.create')
  @ApiOperation({ summary: 'Create stock transfer request' })
  createTransfer(@Body() dto: CreateTransferDto, @Request() req: any) {
    return this.service.createTransfer(dto, req.user.id);
  }

  @Get('transfers/list')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'List stock transfers' })
  findAllTransfers(
    @Query('storeId') storeId?: string,
    @Query('status') status?: TransferStatus,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAllTransfers(storeId, status, limit);
  }

  @Get('transfers/:id')
  @AuthWithPermissions('stores.read')
  @ApiOperation({ summary: 'Get transfer by ID' })
  findTransfer(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findTransfer(id);
  }

  @Post('transfers/:id/approve')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Approve and dispatch transfer' })
  approveTransfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveTransferDto, @Request() req: any) {
    return this.service.approveTransfer(id, dto, req.user.id);
  }

  @Post('transfers/:id/receive')
  @AuthWithPermissions('stores.update')
  @ApiOperation({ summary: 'Receive stock transfer' })
  receiveTransfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveTransferDto, @Request() req: any) {
    return this.service.receiveTransfer(id, dto, req.user.id);
  }

  @Post('transfers/:id/cancel')
  @AuthWithPermissions('stores.delete')
  @ApiOperation({ summary: 'Cancel transfer' })
  cancelTransfer(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancelTransfer(id);
  }
}
