import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionItem, Dispensation, MedicationAdministration } from '../../database/entities/prescription.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, PrescriptionItem, Dispensation, MedicationAdministration, Encounter, Item, StockBalance, StockLedger]),
    forwardRef(() => BillingModule),
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
