import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationConfig } from '../../database/entities/notification-config.entity';
import { PatientReminder } from '../../database/entities/patient-reminder.entity';
import { Patient } from '../../database/entities/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationConfig, PatientReminder, Patient]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
