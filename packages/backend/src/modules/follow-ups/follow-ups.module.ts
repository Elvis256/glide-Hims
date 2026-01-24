import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { FollowUpsService } from './follow-ups.service';
import { FollowUpsController } from './follow-ups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FollowUp])],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
