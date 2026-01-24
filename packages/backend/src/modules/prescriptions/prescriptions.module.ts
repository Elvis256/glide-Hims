import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { Prescription, PrescriptionItem, Dispensation } from '../../database/entities/prescription.entity';
import { Encounter } from '../../database/entities/encounter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, PrescriptionItem, Dispensation, Encounter])],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
