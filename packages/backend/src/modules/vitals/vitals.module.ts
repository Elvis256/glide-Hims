import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { AuditModule } from '../../common/interceptors/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vital, Encounter]),
    InAppNotificationsModule,
    AuditModule,
  ],
  controllers: [VitalsController],
  providers: [VitalsService],
  exports: [VitalsService],
})
export class VitalsModule {}
