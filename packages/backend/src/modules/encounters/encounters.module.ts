import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { InAppNotificationModule } from '../in-app-notifications/in-app-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encounter, Patient]),
    InAppNotificationModule,
  ],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
