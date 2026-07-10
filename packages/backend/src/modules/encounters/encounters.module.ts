import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Service } from '../../database/entities/service-category.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { InsurancePolicy } from '../../database/entities/insurance-policy.entity';
import { Facility } from '../../database/entities/facility.entity';
import { Department } from '../../database/entities/department.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { BillingModule } from '../billing/billing.module';
import { QueueManagementModule } from '../queue-management/queue-management.module';
import { InsuranceModule } from '../insurance/insurance.module';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      Patient,
      Service,
      ClinicalNote,
      InsurancePolicy,
      Facility,
      Department,
    ]),
    InAppNotificationsModule,
    forwardRef(() => BillingModule),
    forwardRef(() => QueueManagementModule),
    forwardRef(() => InsuranceModule),
    FollowUpsModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
