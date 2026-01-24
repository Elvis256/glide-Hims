import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DischargeSummary } from '../../database/entities/discharge-summary.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DischargeService } from './discharge.service';
import { DischargeController } from './discharge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DischargeSummary, Encounter])],
  controllers: [DischargeController],
  providers: [DischargeService],
  exports: [DischargeService],
})
export class DischargeModule {}
