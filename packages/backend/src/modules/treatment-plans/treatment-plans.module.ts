import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TreatmentPlan } from '../../database/entities/treatment-plan.entity';
import { TreatmentPlansService } from './treatment-plans.service';
import { TreatmentPlansController } from './treatment-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TreatmentPlan])],
  controllers: [TreatmentPlansController],
  providers: [TreatmentPlansService],
  exports: [TreatmentPlansService],
})
export class TreatmentPlansModule {}
