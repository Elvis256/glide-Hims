import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionItem, Dispensation } from '../../database/entities/prescription.entity';
import { MedicationAdministration } from '../../database/entities/medication-administration.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { BillingModule } from '../billing/billing.module';
import { InAppNotificationModule } from '../in-app-notifications/in-app-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, PrescriptionItem, Dispensation, MedicationAdministration, Encounter, Item, StockBalance, StockLedger]),
    forwardRef(() => BillingModule),
    InAppNotificationModule,
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
