import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceItem, Payment } from '../../database/entities/invoice.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { InAppNotificationModule } from '../in-app-notifications/in-app-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Encounter]),
    NotificationsModule,
    SystemSettingsModule,
    InAppNotificationModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
