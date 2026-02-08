import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Patient } from '../../database/entities/patient.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Invoice, Payment } from '../../database/entities/invoice.entity';
import { Order } from '../../database/entities/order.entity';
import { Admission } from '../../database/entities/admission.entity';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Item, StockBalance } from '../../database/entities/inventory.entity';
import { LabResult } from '../../database/entities/lab-result.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      Invoice,
      Payment,
      Order,
      Admission,
      EmergencyCase,
      AuditLog,
      Item,
      StockBalance,
      LabResult,
      LabSample,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
