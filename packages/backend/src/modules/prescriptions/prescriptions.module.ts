import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { DURReportsController } from './dur-reports.controller';
import { DURReportsService } from './dur-reports.service';
import { RxTemplateService } from './rx-template.service';
import { RxNotificationService } from './rx-notification.service';
import { RxTemplateNotificationController } from './rx-template-notification.controller';
import {
  Prescription,
  PrescriptionItem,
  Dispensation,
  MedicationAdministration,
} from '../../database/entities/prescription.entity';
import { PrescriptionTemplate } from '../../database/entities/rx-template.entity';
import { RxNotificationLog } from '../../database/entities/rx-notification.entity';
import { DrugClassification } from '../../database/entities/drug-classification.entity';
import { ControlledSubstanceLog } from '../../database/entities/controlled-substance.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { BillingModule } from '../billing/billing.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { QueueManagementModule } from '../queue-management/queue-management.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DrugManagementModule } from '../drug-management/drug-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionItem,
      Dispensation,
      MedicationAdministration,
      ControlledSubstanceLog,
      Encounter,
      Item,
      StockBalance,
      StockLedger,
      DrugClassification,
      PrescriptionTemplate,
      RxNotificationLog,
    ]),
    forwardRef(() => BillingModule),
    InAppNotificationsModule,
    QueueManagementModule,
    IntegrationsModule,
    DrugManagementModule,
  ],
  controllers: [PrescriptionsController, DURReportsController, RxTemplateNotificationController],
  providers: [PrescriptionsService, DURReportsService, RxTemplateService, RxNotificationService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
