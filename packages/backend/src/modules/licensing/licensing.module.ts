import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { PhoneHomeService } from './phone-home.service';
import { PhoneHomeController } from './phone-home.controller';
import { LicenseBootstrapService } from './license-bootstrap.service';
import { UpdateClientService } from './update-client.service';
import { License } from '../../database/entities/license.entity';
import { PhoneHomeRecord } from '../../database/entities/phone-home-record.entity';
import { AppVersion } from '../../database/entities/app-version.entity';
import { Deployment } from '../../database/entities/deployment.entity';
import { UpdateRollout } from '../../database/entities/update-rollout.entity';
import { LicenseGuard } from './guards/license.guard';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([License, PhoneHomeRecord, AppVersion, Deployment, UpdateRollout]),
    ScheduleModule.forRoot(),
  ],
  controllers: [LicenseController, PhoneHomeController],
  providers: [LicenseService, PhoneHomeService, LicenseGuard, LicenseBootstrapService, UpdateClientService],
  exports: [LicenseService, PhoneHomeService, LicenseGuard, UpdateClientService],
})
export class LicensingModule {}
