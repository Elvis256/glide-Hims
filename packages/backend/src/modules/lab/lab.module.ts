import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTest } from '../../database/entities/lab-test.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { LabResult } from '../../database/entities/lab-result.entity';
import { Order } from '../../database/entities/order.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabTest, LabSample, LabResult, Order, Patient, Facility]),
  ],
  controllers: [LabController],
  providers: [LabService],
  exports: [LabService],
})
export class LabModule {}
