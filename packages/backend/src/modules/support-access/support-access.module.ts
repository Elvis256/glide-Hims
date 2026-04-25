import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportAccessGrant } from '../../database/entities/support-access-grant.entity';
import { SupportAccessRequest } from './support-access-request.entity';
import { SupportAccessService } from './support-access.service';
import { SupportAccessController } from './support-access.controller';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SupportAccessGrant, SupportAccessRequest]),
    InAppNotificationsModule,
  ],
  controllers: [SupportAccessController],
  providers: [SupportAccessService],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
