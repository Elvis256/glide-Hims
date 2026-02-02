import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RFQController } from './rfq.controller';
import { RFQService } from './rfq.service';
import { RFQ, RFQItem, RFQVendor, VendorQuotation, VendorQuotationItem, QuotationApproval } from '../../database/entities/rfq.entity';
import { Supplier } from '../../database/entities/supplier.entity';

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
    ]),
  ],
  controllers: [RFQController],
  providers: [RFQService],
  exports: [RFQService],
})
export class RFQModule {}
