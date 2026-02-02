import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceMatchingController } from './invoice-matching.controller';
import { InvoiceMatchingService } from './invoice-matching.service';
import { InvoiceMatch, InvoiceMatchItem } from '../../database/entities/invoice-match.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote } from '../../database/entities/goods-receipt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceMatch, InvoiceMatchItem, PurchaseOrder, GoodsReceiptNote])],
  controllers: [InvoiceMatchingController],
  providers: [InvoiceMatchingService],
  exports: [InvoiceMatchingService],
})
export class InvoiceMatchingModule {}
