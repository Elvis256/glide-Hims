import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { Employee } from '../../database/entities/employee.entity';
import { AttendanceRecord } from '../../database/entities/attendance.entity';
import { LeaveRequest } from '../../database/entities/leave-request.entity';
import { PayrollRun } from '../../database/entities/payroll-run.entity';
import { Payslip } from '../../database/entities/payslip.entity';
import { ShiftDefinition } from '../../database/entities/shift-definition.entity';
import { StaffRoster } from '../../database/entities/staff-roster.entity';
import { ShiftSwapRequest } from '../../database/entities/shift-swap-request.entity';
import { JobPosting } from '../../database/entities/job-posting.entity';
import { JobApplication } from '../../database/entities/job-application.entity';
import { PerformanceAppraisal } from '../../database/entities/performance-appraisal.entity';
import { TrainingProgram } from '../../database/entities/training-program.entity';
import { TrainingEnrollment } from '../../database/entities/training-enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      AttendanceRecord,
      LeaveRequest,
      PayrollRun,
      Payslip,
      ShiftDefinition,
      StaffRoster,
      ShiftSwapRequest,
      JobPosting,
      JobApplication,
      PerformanceAppraisal,
      TrainingProgram,
      TrainingEnrollment,
    ]),
  ],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
