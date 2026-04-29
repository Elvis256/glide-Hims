import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ExpiryAlert } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Provider } from '../../database/entities/provider.entity';
import { User } from '../../database/entities/user.entity';
import { InAppNotification } from '../../database/entities/in-app-notification.entity';
import { Facility } from '../../database/entities/facility.entity';
import { ExpiryAlertConfig, ExpiryAlertHistory } from '../../database/entities/expiry-alert.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Patient } from '../../database/entities/patient.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpiryAlert,
      BatchStockBalance,
      Appointment,
      Provider,
      User,
      InAppNotification,
      Facility,
      ExpiryAlertConfig,
      ExpiryAlertHistory,
      Invoice,
      Patient,
    ]),
    InAppNotificationsModule,
    NotificationsModule,
  ],
  providers: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
