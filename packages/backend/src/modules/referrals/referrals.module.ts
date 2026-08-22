import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from '../../database/entities/referral.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Referral]), InAppNotificationsModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
