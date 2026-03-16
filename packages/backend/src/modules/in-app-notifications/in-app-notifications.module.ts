import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InAppNotification } from '../../database/entities/in-app-notification.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { NotificationsGateway } from './notifications.gateway';
import { InAppNotificationsService } from './in-app-notifications.service';
import { InAppNotificationsController } from './in-app-notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InAppNotification, UserRole, Role]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [InAppNotificationsController],
  providers: [NotificationsGateway, InAppNotificationsService],
  exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
