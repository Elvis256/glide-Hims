import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Queue, QueueDisplay } from '../../database/entities/queue.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { Invoice, InvoiceItem } from '../../database/entities/invoice.entity';
import { Service } from '../../database/entities/service-category.entity';
import { QueueManagementService } from './queue-management.service';
import { QueueManagementController } from './queue-management.controller';
import { AfricasTalkingService } from '../integrations/africas-talking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, QueueDisplay, Encounter, DoctorDuty, AuditLog, SystemSetting, Invoice, InvoiceItem, Service]),
    HttpModule.register({ timeout: 10000 }),
  ],
  controllers: [QueueManagementController],
  providers: [QueueManagementService, AfricasTalkingService],
  exports: [QueueManagementService],
})
export class QueueManagementModule {}
