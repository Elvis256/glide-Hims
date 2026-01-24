import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vital, Encounter])],
  controllers: [VitalsController],
  providers: [VitalsService],
  exports: [VitalsService],
})
export class VitalsModule {}
