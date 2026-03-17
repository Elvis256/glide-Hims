import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdherenceController } from './adherence.controller';
import { AdherenceService } from './adherence.service';
import { MedicationAdherenceRecord } from '../../database/entities/medication-adherence.entity';
import { Prescription, PrescriptionItem } from '../../database/entities/prescription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicationAdherenceRecord,
      Prescription,
      PrescriptionItem,
    ]),
  ],
  controllers: [AdherenceController],
  providers: [AdherenceService],
  exports: [AdherenceService],
})
export class AdherenceModule {}
