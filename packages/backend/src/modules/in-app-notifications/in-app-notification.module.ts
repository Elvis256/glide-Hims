import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { InAppNotification } from '../../database/entities/in-app-notification.entity';
import { InAppNotificationService } from './in-app-notification.service';
import { InAppNotificationController } from './in-app-notification.controller';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([InAppNotification]), ConfigModule, JwtModule.register({})],
  controllers: [InAppNotificationController],
  providers: [InAppNotificationService, NotificationGateway],
  exports: [InAppNotificationService],
})
export class InAppNotificationModule {}
