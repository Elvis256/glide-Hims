import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { PatientProblem } from '../../database/entities/patient-problem.entity';
import { Diagnosis } from '../../database/entities/diagnosis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PatientProblem, Diagnosis])],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
