import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { Store } from '../../database/entities/store.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { StockTransfer } from '../../database/entities/stock-transfer.entity';
import { StockTransferItem } from '../../database/entities/stock-transfer-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      Item,
      StockBalance,
      StockLedger,
      StockTransfer,
      StockTransferItem,
    ]),
  ],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
