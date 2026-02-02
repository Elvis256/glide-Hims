import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { Store, StockTransfer, StockTransferItem } from '../../database/entities/store.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StockTransfer, StockTransferItem, Item, StockBalance, StockLedger])],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
