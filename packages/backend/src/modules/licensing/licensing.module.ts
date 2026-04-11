import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { PhoneHomeService } from './phone-home.service';
import { PhoneHomeController } from './phone-home.controller';
import { License } from '../../database/entities/license.entity';
import { PhoneHomeRecord } from '../../database/entities/phone-home-record.entity';
import { AppVersion } from '../../database/entities/app-version.entity';
import { LicenseGuard } from './guards/license.guard';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([License, PhoneHomeRecord, AppVersion]),
    ScheduleModule.forRoot(),
  ],
  controllers: [LicenseController, PhoneHomeController],
  providers: [LicenseService, PhoneHomeService, LicenseGuard],
  exports: [LicenseService, PhoneHomeService, LicenseGuard],
})
export class LicensingModule {}
