import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, Payment } from '../../database/entities/invoice.entity';
import { Encounter } from '../../database/entities/encounter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Encounter])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
