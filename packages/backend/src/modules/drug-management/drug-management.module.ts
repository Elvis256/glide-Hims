import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrugManagementController } from './drug-management.controller';
import { DrugManagementService } from './drug-management.service';
import {
  DrugClassification,
  DrugInteraction,
  DrugAllergyClass,
} from '../../database/entities/drug-classification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DrugClassification,
      DrugInteraction,
      DrugAllergyClass,
    ]),
  ],
  controllers: [DrugManagementController],
  providers: [DrugManagementService],
  exports: [DrugManagementService],
})
export class DrugManagementModule {}
