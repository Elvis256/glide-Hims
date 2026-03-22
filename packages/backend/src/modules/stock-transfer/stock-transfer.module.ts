import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransferService } from './stock-transfer.service';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransfer } from '../../database/entities/stock-transfer.entity';
import { StockTransferItem } from '../../database/entities/stock-transfer-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockTransfer, StockTransferItem])],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
