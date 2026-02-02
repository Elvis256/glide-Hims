import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChronicCareController } from './chronic-care.controller';
import { ChronicCareService } from './chronic-care.service';
import { PatientChronicCondition } from '../../database/entities/patient-chronic-condition.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientChronicCondition, Patient, Diagnosis]),
    NotificationsModule,
  ],
  controllers: [ChronicCareController],
  providers: [ChronicCareService],
  exports: [ChronicCareService],
})
export class ChronicCareModule {}
