import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Invoice, Payment } from '../../database/entities/invoice.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { PatientProblem } from '../../database/entities/patient-problem.entity';
import { Admission } from '../../database/entities/admission.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { LabTest } from '../../database/entities/lab-test.entity';
import { Department } from '../../database/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      Patient,
      Invoice,
      Payment,
      Item,
      StockBalance,
      StockLedger,
      BatchStockBalance,
      Diagnosis,
      PatientProblem,
      Admission,
      LabSample,
      LabTest,
      Department,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
