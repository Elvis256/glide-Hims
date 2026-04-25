import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierScoringService } from './supplier-scoring.service';
import { Supplier } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote, GoodsReceiptItem } from '../../database/entities/goods-receipt.entity';
import { InvoiceMatch } from '../../database/entities/invoice-match.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      PurchaseOrder,
      GoodsReceiptNote,
      GoodsReceiptItem,
      InvoiceMatch,
    ]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierScoringService],
  exports: [SuppliersService, SupplierScoringService],
})
export class SuppliersModule {}
