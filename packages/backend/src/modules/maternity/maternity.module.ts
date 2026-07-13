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
import { NotificationsModule } from '../notifications/notifications.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { PartographObservation } from '../../database/entities/partograph-observation.entity';
import { PartographService } from './partograph.service';

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
      PartographObservation,
    ]),
    NotificationsModule,
    InAppNotificationsModule,
  ],
  controllers: [MaternityController],
  providers: [MaternityService, PartographService],
  exports: [MaternityService, PartographService],
})
export class MaternityModule {}
