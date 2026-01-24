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
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
