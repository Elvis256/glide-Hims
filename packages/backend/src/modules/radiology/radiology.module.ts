import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RadiologyService } from './radiology.service';
import { RadiologyController } from './radiology.controller';
import { ImagingModality } from '../../database/entities/imaging-modality.entity';
import { ImagingOrder } from '../../database/entities/imaging-order.entity';
import { ImagingResult } from '../../database/entities/imaging-result.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImagingModality,
      ImagingOrder,
      ImagingResult,
    ]),
    InAppNotificationsModule,
  ],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
