import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAllergy } from '../../database/entities/patient-allergy.entity';
import { PrescriptionSafetyOverride } from '../../database/entities/prescription-safety-override.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DrugClassification } from '../../database/entities/drug-classification.entity';
import { Item } from '../../database/entities/inventory.entity';
import { AllergiesService } from './allergies.service';
import { AllergiesController } from './allergies.controller';
import { MedicationSafetyService } from './medication-safety.service';
import { DoseCheckService } from './dose-check.service';
import { DrugManagementModule } from '../drug-management/drug-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientAllergy,
      PrescriptionSafetyOverride,
      Patient,
      Vital,
      Encounter,
      DrugClassification,
      Item,
    ]),
    forwardRef(() => DrugManagementModule),
  ],
  controllers: [AllergiesController],
  providers: [AllergiesService, MedicationSafetyService, DoseCheckService],
  exports: [AllergiesService, MedicationSafetyService, DoseCheckService],
})
export class AllergiesModule {}
