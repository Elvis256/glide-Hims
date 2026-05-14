import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RadiologyService } from './radiology.service';
import { RadiologyController } from './radiology.controller';
import { ImagingModality } from '../../database/entities/imaging-modality.entity';
import { ImagingOrder } from '../../database/entities/imaging-order.entity';
import { ImagingResult } from '../../database/entities/imaging-result.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinanceModule } from '../finance/finance.module';
import { CriticalResultsModule } from '../critical-results/critical-results.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImagingModality, ImagingOrder, ImagingResult]),
    InAppNotificationsModule,
    NotificationsModule,
    forwardRef(() => FinanceModule),
    CriticalResultsModule,
  ],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
