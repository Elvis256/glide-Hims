import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ExpiryAlert } from '../../database/entities/inventory.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Provider } from '../../database/entities/provider.entity';
import { User } from '../../database/entities/user.entity';
import { InAppNotification } from '../../database/entities/in-app-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpiryAlert, BatchStockBalance, Appointment, Provider, User, InAppNotification]),
  ],
  providers: [ScheduledTasksService],
})
export class ScheduledTasksModule {}
