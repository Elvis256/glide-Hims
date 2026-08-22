import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Queue } from '../../database/entities/queue.entity';
import { TriageAssessment } from '../../database/entities/triage-assessment.entity';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { TriageAssessmentService } from './triage-assessment.service';
import { TriageAssessmentController } from './triage-assessment.controller';
import { VitalsModule } from '../vitals/vitals.module';
import { IpdModule } from '../ipd/ipd.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyCase, Encounter, Patient, Queue, TriageAssessment]),
    VitalsModule,
    // Admitting out of the emergency department creates a real IPD admission
    // rather than leaving it to the caller to make a second request.
    IpdModule,
  ],
  controllers: [EmergencyController, TriageAssessmentController],
  providers: [EmergencyService, TriageAssessmentService],
  exports: [EmergencyService, TriageAssessmentService],
})
export class EmergencyModule {}
