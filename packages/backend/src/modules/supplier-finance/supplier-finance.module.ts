import { Module, forwardRef } from '@nestjs/common';
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
  SupplierCreditNoteApplication,
} from '../../database/entities/supplier-credit-note.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { GoodsReceiptNote } from '../../database/entities/goods-receipt.entity';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierPayment,
      SupplierPaymentItem,
      SupplierCreditNote,
      SupplierCreditNoteItem,
      SupplierCreditNoteApplication,
      Supplier,
      GoodsReceiptNote,
    ]),
    forwardRef(() => FinanceModule),
  ],
  controllers: [SupplierFinanceController],
  providers: [SupplierFinanceService],
  exports: [SupplierFinanceService],
})
export class SupplierFinanceModule {}
