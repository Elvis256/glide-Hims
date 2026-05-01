import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';
import { LabelService } from './label.service';
import { TemperatureService } from './temperature.service';
import { PharmacyDashboardService } from './pharmacy-dashboard.service';
import { PrescriptionLookupService } from './prescription-lookup.service';
import { PrescriptionController } from './prescription.controller';
import { PharmacySale, PharmacySaleItem } from '../../database/entities/pharmacy-sale.entity';
import { Store } from '../../database/entities/store.entity';
import {
  Item,
  StockLedger,
  StockBalance,
  ExpiryAlert,
} from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Prescription, PrescriptionItem } from '../../database/entities/prescription.entity';
import {
  DrugLabelTemplate,
  CommonDrugTranslation,
} from '../../database/entities/drug-label-template.entity';
import { TemperatureLog, TemperatureSensor } from '../../database/entities/temperature-log.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { DrugClassification, DrugInteraction } from '../../database/entities/drug-classification.entity';
import { DrugInteractionOverride } from '../../database/entities/drug-interaction-override.entity';
import { ControlledSubstanceLog } from '../../database/entities/controlled-substance.entity';
import { ReceiptReprint, RetailCustomer } from '../../database/entities/pos-retail.entity';
import { FinanceModule } from '../finance/finance.module';
import { PosModule } from '../pos/pos.module';
import { EfrisModule } from '../efris/efris.module';

@Module({
  imports: [
    forwardRef(() => FinanceModule),
    PosModule,
    EfrisModule,
    TypeOrmModule.forFeature([
      PharmacySale,
      PharmacySaleItem,
      Store,
      Item,
      StockLedger,
      StockBalance,
      BatchStockBalance,
      ExpiryAlert,
      Patient,
      Prescription,
      PrescriptionItem,
      DrugLabelTemplate,
      CommonDrugTranslation,
      TemperatureLog,
      TemperatureSensor,
      AuditLog,
      DrugClassification,
      DrugInteraction,
      DrugInteractionOverride,
      ControlledSubstanceLog,
      ReceiptReprint,
      RetailCustomer,
    ]),
  ],
  controllers: [PharmacyController, PrescriptionController],
  providers: [PharmacyService, LabelService, TemperatureService, PharmacyDashboardService, PrescriptionLookupService],
  exports: [PharmacyService, LabelService, TemperatureService, PharmacyDashboardService],
})
export class PharmacyModule {}
