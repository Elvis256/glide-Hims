import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTest } from '../../database/entities/lab-test.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { LabResult } from '../../database/entities/lab-result.entity';
import { Order } from '../../database/entities/order.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import { SampleReferral } from '../../database/entities/sample-referral.entity';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';
import { SampleReferralService } from './sample-referral.service';
import { SampleReferralController } from './sample-referral.controller';
import { BillingModule } from '../billing/billing.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncountersModule } from '../encounters/encounters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabTest,
      LabSample,
      LabResult,
      Order,
      Patient,
      Facility,
      SampleReferral,
    ]),
    forwardRef(() => BillingModule),
    forwardRef(() => EncountersModule),
    InAppNotificationsModule,
    NotificationsModule,
  ],
  controllers: [LabController, SampleReferralController],
  providers: [LabService, SampleReferralService],
  exports: [LabService, SampleReferralService],
})
export class LabModule {}
