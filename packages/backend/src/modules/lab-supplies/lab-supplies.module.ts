import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabSuppliesController } from './lab-supplies.controller';
import { LabSuppliesService } from './lab-supplies.service';
import {
  LabReagent,
  ReagentLot,
  ReagentConsumption,
} from '../../database/entities/lab-reagent.entity';
import {
  LabEquipment,
  EquipmentCalibration,
  EquipmentMaintenance,
} from '../../database/entities/lab-equipment.entity';
import {
  QCMaterial,
  QCResult,
  QCLeveyJenningsData,
} from '../../database/entities/lab-qc.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabReagent,
      ReagentLot,
      ReagentConsumption,
      LabEquipment,
      EquipmentCalibration,
      EquipmentMaintenance,
      QCMaterial,
      QCResult,
      QCLeveyJenningsData,
    ]),
  ],
  controllers: [LabSuppliesController],
  providers: [LabSuppliesService],
  exports: [LabSuppliesService],
})
export class LabSuppliesModule {}
