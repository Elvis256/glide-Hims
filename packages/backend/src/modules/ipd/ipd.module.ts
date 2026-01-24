import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpdController } from './ipd.controller';
import { IpdService } from './ipd.service';
import { Ward } from '../../database/entities/ward.entity';
import { Bed } from '../../database/entities/bed.entity';
import { Admission } from '../../database/entities/admission.entity';
import { NursingNote } from '../../database/entities/nursing-note.entity';
import { MedicationAdministration } from '../../database/entities/medication-administration.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';
import { Encounter } from '../../database/entities/encounter.entity';

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
    ]),
  ],
  controllers: [IpdController],
  providers: [IpdService],
  exports: [IpdService],
})
export class IpdModule {}
