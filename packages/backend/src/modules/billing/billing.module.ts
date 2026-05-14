import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, Payment } from '../../database/entities/invoice.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Queue } from '../../database/entities/queue.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { FinanceModule } from '../finance/finance.module';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { ServicesModule } from '../services/services.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../../common/interceptors/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Encounter, Queue]),
    NotificationsModule,
    InAppNotificationsModule,
    SystemSettingsModule,
    FinanceModule,
    PricingEngineModule,
    forwardRef(() => InsuranceModule),
    ServicesModule,
    InventoryModule,
    AuditModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
