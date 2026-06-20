import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { Backup } from '../../database/entities/backup.entity';
import { BackupSchedule } from '../../database/entities/backup-schedule.entity';
import { DrDrill } from '../../database/entities/dr-drill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Backup, BackupSchedule, DrDrill])],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
