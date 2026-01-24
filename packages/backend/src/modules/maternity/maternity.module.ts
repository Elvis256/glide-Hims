import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AntenatalRegistration } from '../../database/entities/antenatal-registration.entity';
import { AntenatalVisit } from '../../database/entities/antenatal-visit.entity';
import { LabourRecord } from '../../database/entities/labour-record.entity';
import { DeliveryOutcome } from '../../database/entities/delivery-outcome.entity';
import { PostnatalVisit } from '../../database/entities/postnatal-visit.entity';
import { BabyWellnessCheck } from '../../database/entities/baby-wellness-check.entity';
import { ImmunizationSchedule } from '../../database/entities/immunization-schedule.entity';
import { MaternityService } from './maternity.service';
import { MaternityController } from './maternity.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AntenatalRegistration,
      AntenatalVisit,
      LabourRecord,
      DeliveryOutcome,
      PostnatalVisit,
      BabyWellnessCheck,
      ImmunizationSchedule,
    ]),
  ],
  controllers: [MaternityController],
  providers: [MaternityService],
  exports: [MaternityService],
})
export class MaternityModule {}
