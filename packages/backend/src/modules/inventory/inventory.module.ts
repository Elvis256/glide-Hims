import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Item, StockLedger, StockBalance } from '../../database/entities/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item, StockLedger, StockBalance])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
