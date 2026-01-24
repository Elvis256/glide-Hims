import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierFinanceController } from './supplier-finance.controller';
import { SupplierFinanceService } from './supplier-finance.service';
import {
  SupplierPayment,
  SupplierPaymentItem,
} from '../../database/entities/supplier-payment.entity';
import {
  SupplierCreditNote,
  SupplierCreditNoteItem,
} from '../../database/entities/supplier-credit-note.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { GoodsReceiptNote } from '../../database/entities/goods-receipt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierPayment,
      SupplierPaymentItem,
      SupplierCreditNote,
      SupplierCreditNoteItem,
      Supplier,
      GoodsReceiptNote,
    ]),
  ],
  controllers: [SupplierFinanceController],
  providers: [SupplierFinanceService],
  exports: [SupplierFinanceService],
})
export class SupplierFinanceModule {}
