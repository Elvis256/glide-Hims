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
