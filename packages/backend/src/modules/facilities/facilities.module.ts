import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from '../../database/entities/facility.entity';
import { Department } from '../../database/entities/department.entity';
import { Unit } from '../../database/entities/unit.entity';
import { FacilitiesService } from './facilities.service';
import { FacilitiesController } from './facilities.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Facility, Department, Unit])],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
