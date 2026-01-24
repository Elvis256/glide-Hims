import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncQueue } from '../../database/entities/sync-queue.entity';
import { SyncConflict } from '../../database/entities/sync-conflict.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SyncQueue, SyncConflict])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
