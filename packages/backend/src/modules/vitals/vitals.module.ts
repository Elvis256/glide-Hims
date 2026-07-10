import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { DeteriorationMonitorService } from './deterioration-monitor.service';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Queue } from '../../database/entities/queue.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { AuditModule } from '../../common/interceptors/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vital, Encounter, Queue]),
    InAppNotificationsModule,
    AuditModule,
  ],
  controllers: [VitalsController],
  providers: [VitalsService, DeteriorationMonitorService],
  exports: [VitalsService],
})
export class VitalsModule {}
