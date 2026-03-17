import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Service } from '../../database/entities/service-category.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encounter, Patient, Service, ClinicalNote]),
    InAppNotificationsModule,
    forwardRef(() => BillingModule),
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
