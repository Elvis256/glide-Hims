import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Item, StockLedger, StockBalance } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { BatchRecall, BatchRecallAction } from '../../database/entities/batch-recall.entity';
import { CycleCount, CycleCountItem } from '../../database/entities/cycle-count.entity';
import { BatchRecallService } from './batch-recall.service';
import { BatchRecallController } from './batch-recall.controller';
import { CycleCountService } from './cycle-count.service';
import { CycleCountController } from './cycle-count.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      StockLedger,
      StockBalance,
      BatchStockBalance,
      BatchRecall,
      BatchRecallAction,
      CycleCount,
      CycleCountItem,
    ]),
  ],
  controllers: [InventoryController, BatchRecallController, CycleCountController],
  providers: [InventoryService, BatchRecallService, CycleCountService],
  exports: [InventoryService],
})
export class InventoryModule {}
