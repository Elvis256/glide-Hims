import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { DURReportsController } from './dur-reports.controller';
import { DURReportsService } from './dur-reports.service';
import { Prescription, PrescriptionItem, Dispensation, MedicationAdministration } from '../../database/entities/prescription.entity';
import { DrugClassification } from '../../database/entities/drug-classification.entity';
import { ControlledSubstanceLog } from '../../database/entities/controlled-substance.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { BillingModule } from '../billing/billing.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { QueueManagementModule } from '../queue-management/queue-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, PrescriptionItem, Dispensation, MedicationAdministration, ControlledSubstanceLog, Encounter, Item, StockBalance, StockLedger, DrugClassification]),
    forwardRef(() => BillingModule),
    InAppNotificationsModule,
    QueueManagementModule,
  ],
  controllers: [PrescriptionsController, DURReportsController],
  providers: [PrescriptionsService, DURReportsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
