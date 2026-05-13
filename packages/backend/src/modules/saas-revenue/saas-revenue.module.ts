import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SaasPlan, SaasSubscription, SaasInvoice, SaasPayment, SaasCoupon, SaasSubscriptionEvent, SaasEmailLog,
} from './saas.entity';
import { License } from '../../database/entities/license.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { SaasRevenueService } from './saas-revenue.service';
import { SaasRevenueController } from './saas-revenue.controller';
import { SaasMailerService } from './saas-mailer.service';
import { FlutterwaveService } from './flutterwave.service';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaasPlan, SaasSubscription, SaasInvoice, SaasPayment, SaasCoupon, SaasSubscriptionEvent, SaasEmailLog, License, Lead, Tenant]),
    SystemSettingsModule,
  ],
  controllers: [SaasRevenueController],
  providers: [SaasRevenueService, SaasMailerService, FlutterwaveService],
  exports: [SaasRevenueService],
})
export class SaasRevenueModule {}
