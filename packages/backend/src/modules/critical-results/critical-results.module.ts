import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CriticalResultAlert } from '../../database/entities/critical-result-alert.entity';
import { CriticalResultsService } from './critical-results.service';
import { CriticalResultsController } from './critical-results.controller';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CriticalResultAlert]), InAppNotificationsModule, AuthModule],
  controllers: [CriticalResultsController],
  providers: [CriticalResultsService],
  exports: [CriticalResultsService],
})
export class CriticalResultsModule {}
