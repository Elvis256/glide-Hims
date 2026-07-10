import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PatientDebtService } from './patient-debt.service';
import { PatientDebtController } from './patient-debt.controller';
import { Invoice, InvoiceItem, Payment } from '../../database/entities/invoice.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Queue } from '../../database/entities/queue.entity';
import { Patient } from '../../database/entities/patient.entity';
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
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Encounter, Queue, Patient]),
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
  controllers: [BillingController, PatientDebtController],
  providers: [BillingService, PatientDebtService],
  exports: [BillingService, PatientDebtService],
})
export class BillingModule {}
