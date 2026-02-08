import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
import { User } from '../../database/entities/user.entity';
import { Department } from '../../database/entities/department.entity';
import { StaffDocument } from '../../database/entities/staff-document.entity';
import { Role } from '../../database/entities/role.entity';
import { UserRole } from '../../database/entities/user-role.entity';

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
      User,
      Department,
      StaffDocument,
      Role,
      UserRole,
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/staff-documents',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req: any, file: any, cb: any) => {
        const allowedTypes = /pdf|jpg|jpeg|png|doc|docx/;
        const ext = extname(file.originalname).toLowerCase().replace('.', '');
        if (allowedTypes.test(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
