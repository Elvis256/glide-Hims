import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RFQController } from './rfq.controller';
import { RFQService } from './rfq.service';
import {
  RFQ,
  RFQItem,
  RFQVendor,
  VendorQuotation,
  VendorQuotationItem,
  QuotationApproval,
} from '../../database/entities/rfq.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { User } from '../../database/entities/user.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RFQ,
      RFQItem,
      RFQVendor,
      VendorQuotation,
      VendorQuotationItem,
      QuotationApproval,
      Supplier,
      User,
      PurchaseOrder,
    ]),
  ],
  controllers: [RFQController],
  providers: [RFQService],
  exports: [RFQService],
})
export class RFQModule {}
