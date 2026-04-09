import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportAccessGrant } from '../../database/entities/support-access-grant.entity';
import { SupportAccessService } from './support-access.service';
import { SupportAccessController } from './support-access.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SupportAccessGrant])],
  controllers: [SupportAccessController],
  providers: [SupportAccessService],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
