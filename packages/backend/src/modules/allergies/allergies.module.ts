import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAllergy } from '../../database/entities/patient-allergy.entity';
import { PrescriptionSafetyOverride } from '../../database/entities/prescription-safety-override.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DrugClassification } from '../../database/entities/drug-classification.entity';
import { Item } from '../../database/entities/inventory.entity';
import { DrugDiseaseInteraction } from '../../database/entities/drug-disease-interaction.entity';
import { PatientChronicCondition } from '../../database/entities/patient-chronic-condition.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { AllergiesService } from './allergies.service';
import { AllergiesController } from './allergies.controller';
import { DrugDiseaseController } from './drug-disease.controller';
import { MedicationSafetyService } from './medication-safety.service';
import { DrugDiseaseService } from './drug-disease.service';
import { DoseCheckService } from './dose-check.service';
import { DrugManagementModule } from '../drug-management/drug-management.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';

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
      DrugDiseaseInteraction,
      PatientChronicCondition,
      ClinicalNote,
    ]),
    forwardRef(() => DrugManagementModule),
    forwardRef(() => PrescriptionsModule),
  ],
  controllers: [AllergiesController, DrugDiseaseController],
  providers: [AllergiesService, MedicationSafetyService, DoseCheckService, DrugDiseaseService],
  exports: [AllergiesService, MedicationSafetyService, DoseCheckService, DrugDiseaseService],
})
export class AllergiesModule {}
