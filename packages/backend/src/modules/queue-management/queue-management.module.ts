import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Queue, QueueDisplay } from '../../database/entities/queue.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { QueueManagementService } from './queue-management.service';
import { QueueManagementController } from './queue-management.controller';
import { AfricasTalkingService } from '../integrations/africas-talking.service';
import { InAppNotificationModule } from '../in-app-notifications/in-app-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, QueueDisplay, Encounter, DoctorDuty, AuditLog, SystemSetting]),
    HttpModule.register({ timeout: 10000 }),
    InAppNotificationModule,
  ],
  controllers: [QueueManagementController],
  providers: [QueueManagementService, AfricasTalkingService],
  exports: [QueueManagementService],
})
export class QueueManagementModule {}
