import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, QueueDisplay } from '../../database/entities/queue.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { QueueManagementService } from './queue-management.service';
import { QueueManagementController } from './queue-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, QueueDisplay, Encounter, DoctorDuty])],
  controllers: [QueueManagementController],
  providers: [QueueManagementService],
  exports: [QueueManagementService],
})
export class QueueManagementModule {}
