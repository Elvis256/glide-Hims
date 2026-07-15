import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeOutputEntry } from '../../database/entities/intake-output-entry.entity';
import { BloodGlucoseReading } from '../../database/entities/blood-glucose-reading.entity';
import { NeuroObservation } from '../../database/entities/neuro-observation.entity';
import { IncidentReport } from '../../database/entities/incident-report.entity';
import { CarePlan } from '../../database/entities/care-plan.entity';
import { CarePlanGoal } from '../../database/entities/care-plan-goal.entity';
import { CarePlanIntervention } from '../../database/entities/care-plan-intervention.entity';
import { WoundAssessment } from '../../database/entities/wound-assessment.entity';
import { NursingController } from './nursing.controller';
import { IntakeOutputService } from './intake-output.service';
import { BloodGlucoseService } from './blood-glucose.service';
import { NeuroObservationService } from './neuro-observation.service';
import { IncidentReportService } from './incident-report.service';
import { CarePlanService } from './care-plan.service';
import { WoundAssessmentService } from './wound-assessment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntakeOutputEntry,
      BloodGlucoseReading,
      NeuroObservation,
      IncidentReport,
      CarePlan,
      CarePlanGoal,
      CarePlanIntervention,
      WoundAssessment,
    ]),
  ],
  controllers: [NursingController],
  providers: [
    IntakeOutputService,
    BloodGlucoseService,
    NeuroObservationService,
    IncidentReportService,
    CarePlanService,
    WoundAssessmentService,
  ],
  exports: [
    IntakeOutputService,
    BloodGlucoseService,
    NeuroObservationService,
    IncidentReportService,
    CarePlanService,
    WoundAssessmentService,
  ],
})
export class NursingModule {}
