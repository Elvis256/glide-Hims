import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SaasPlan, SaasSubscription, SaasInvoice, SaasPayment, SaasCoupon, SaasSubscriptionEvent,
} from './saas.entity';
import { License } from '../../database/entities/license.entity';
import { SaasRevenueService } from './saas-revenue.service';
import { SaasRevenueController } from './saas-revenue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SaasPlan, SaasSubscription, SaasInvoice, SaasPayment, SaasCoupon, SaasSubscriptionEvent, License])],
  controllers: [SaasRevenueController],
  providers: [SaasRevenueService],
  exports: [SaasRevenueService],
})
export class SaasRevenueModule {}
