import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, QueueDisplay } from '../../database/entities/queue.entity';
import { QueueManagementService } from './queue-management.service';
import { QueueManagementController } from './queue-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, QueueDisplay])],
  controllers: [QueueManagementController],
  providers: [QueueManagementService],
  exports: [QueueManagementService],
})
export class QueueManagementModule {}
