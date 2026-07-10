import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SaasPlan,
  SaasSubscription,
  SaasInvoice,
  SaasPayment,
  SaasCoupon,
  SaasSubscriptionEvent,
  SaasEmailLog,
  SaasPaymentMethod,
  SaasWebhookEndpoint,
  SaasWebhookDelivery,
} from './saas.entity';
import { SaasPaymentProof } from './payment-proof.entity';
import { SaasPriceCatalogItem, SaasQuotation, SaasQuotationRevision } from './quotation.entity';
import { SaasContract } from './contract.entity';
import { ClientOnboarding, ClientOnboardingItem } from './onboarding.entity';
import { ClientHealthScore } from './client-health.entity';
import { License } from '../../database/entities/license.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Deployment } from '../../database/entities/deployment.entity';
import { Lead, LeadActivity } from '../leads/lead.entity';
import { SaasRevenueService } from './saas-revenue.service';
import { SaasRevenueController } from './saas-revenue.controller';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { ClientHealthService } from './client-health.service';
import { ClientHealthController } from './client-health.controller';
import { LifecycleEventsListener } from './lifecycle-events.listener';
import { SaasMailerService } from './saas-mailer.service';
import { FlutterwaveService } from './flutterwave.service';
import { PesapalService } from './pesapal.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import {
  UsageMeterEvent,
  UsageMeterAggregate,
  UsageQuota,
  UsageAlert,
} from '../../database/entities/usage-meter.entity';
import { UsageMeterService } from './usage-meter.service';
import { UsageMeterController } from './usage-meter.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasPlan,
      SaasSubscription,
      SaasInvoice,
      SaasPayment,
      SaasCoupon,
      SaasSubscriptionEvent,
      SaasEmailLog,
      SaasPaymentMethod,
      SaasWebhookEndpoint,
      SaasWebhookDelivery,
      SaasPaymentProof,
      SaasPriceCatalogItem,
      SaasQuotation,
      SaasQuotationRevision,
      SaasContract,
      ClientOnboarding,
      ClientOnboardingItem,
      ClientHealthScore,
      License,
      Lead,
      LeadActivity,
      Tenant,
      Deployment,
      UsageMeterEvent,
      UsageMeterAggregate,
      UsageQuota,
      UsageAlert,
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/saas-payment-proofs',
        filename: (_req, file, callback) => {
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Invalid file type. Allowed: PDF, JPG, PNG'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    SystemSettingsModule,
  ],
  controllers: [
    SaasRevenueController,
    QuotationController,
    ContractController,
    OnboardingController,
    ClientHealthController,
    UsageMeterController,
  ],
  providers: [
    SaasRevenueService,
    QuotationService,
    ContractService,
    OnboardingService,
    ClientHealthService,
    UsageMeterService,
    LifecycleEventsListener,
    SaasMailerService,
    FlutterwaveService,
    PesapalService,
    WebhookDispatcherService,
  ],
  exports: [
    SaasRevenueService,
    QuotationService,
    ContractService,
    OnboardingService,
    ClientHealthService,
    UsageMeterService,
  ],
})
export class SaasRevenueModule {}
