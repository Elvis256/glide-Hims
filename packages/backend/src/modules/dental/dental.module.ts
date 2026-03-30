import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DentalService } from './dental.service';
import { DentalController } from './dental.controller';
import {
  DentalChart,
  ToothRecord,
  DentalProcedure,
  DentalTreatmentPlan,
  TreatmentPlanItem,
  DentalImage,
  DentalLabOrder,
  OrthodonticCase,
  PeriodontalChart,
} from '../../database/entities/dental.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DentalChart,
      ToothRecord,
      DentalProcedure,
      DentalTreatmentPlan,
      TreatmentPlanItem,
      DentalImage,
      DentalLabOrder,
      OrthodonticCase,
      PeriodontalChart,
    ]),
  ],
  controllers: [DentalController],
  providers: [DentalService],
  exports: [DentalService],
})
export class DentalModule {}
