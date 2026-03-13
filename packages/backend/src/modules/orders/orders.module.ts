import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from '../../database/entities/order.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Service } from '../../database/entities/service-category.entity';
import { LabTest } from '../../database/entities/lab-test.entity';
import { ImagingOrder } from '../../database/entities/imaging-order.entity';
import { ImagingModality } from '../../database/entities/imaging-modality.entity';
import { BillingModule } from '../billing/billing.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { QueueManagementModule } from '../queue-management/queue-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Encounter, Service, LabTest, ImagingOrder, ImagingModality]),
    forwardRef(() => BillingModule),
    InAppNotificationsModule,
    QueueManagementModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
