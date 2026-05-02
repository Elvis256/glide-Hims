import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpdController } from './ipd.controller';
import { IpdService } from './ipd.service';
import { BedBoardService } from './bed-board.service';
import { Ward } from '../../database/entities/ward.entity';
import { Bed } from '../../database/entities/bed.entity';
import { Admission } from '../../database/entities/admission.entity';
import { NursingNote } from '../../database/entities/nursing-note.entity';
import { MedicationAdministration } from '../../database/entities/medication-administration.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PrescriptionItem } from '../../database/entities/prescription.entity';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../../common/interceptors/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ward,
      Bed,
      Admission,
      NursingNote,
      MedicationAdministration,
      BedTransfer,
      Encounter,
      Patient,
      PrescriptionItem,
    ]),
    forwardRef(() => BillingModule),
    AuditModule,
  ],
  controllers: [IpdController],
  providers: [IpdService, BedBoardService],
  exports: [IpdService, BedBoardService],
})
export class IpdModule {}
