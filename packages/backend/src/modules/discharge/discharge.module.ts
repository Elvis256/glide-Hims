import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DischargeSummary } from '../../database/entities/discharge-summary.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { MedicationReconciliation, MedicationReconciliationItem } from '../../database/entities/medication-reconciliation.entity';
import { PatientActiveMedication } from '../../database/entities/patient-active-medication.entity';
import { Prescription } from '../../database/entities/prescription.entity';
import { DischargeService } from './discharge.service';
import { DischargeController } from './discharge.controller';
import { MedicationReconciliationService } from './medication-reconciliation.service';
import { MedicationReconciliationController } from './medication-reconciliation.controller';
import { VitalsModule } from '../vitals/vitals.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DischargeSummary,
      Encounter,
      MedicationReconciliation,
      MedicationReconciliationItem,
      PatientActiveMedication,
      Prescription,
    ]),
    VitalsModule,
  ],
  controllers: [DischargeController, MedicationReconciliationController],
  providers: [DischargeService, MedicationReconciliationService],
  exports: [DischargeService, MedicationReconciliationService],
})
export class DischargeModule {}
