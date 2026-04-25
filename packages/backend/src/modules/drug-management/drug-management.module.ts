import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DrugManagementController } from './drug-management.controller';
import { DrugManagementService } from './drug-management.service';
import { DrugDbSyncController } from './drug-db-sync.controller';
import { DrugDbSyncService } from './drug-db-sync.service';
import {
  DrugClassification,
  DrugInteraction,
  DrugAllergyClass,
} from '../../database/entities/drug-classification.entity';
import { DrugSyncLog } from '../../database/entities/drug-sync-log.entity';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DrugClassification, DrugInteraction, DrugAllergyClass, DrugSyncLog]),
    IntegrationsModule,
  ],
  controllers: [DrugManagementController, DrugDbSyncController],
  providers: [DrugManagementService, DrugDbSyncService],
  exports: [DrugManagementService],
})
export class DrugManagementModule {}
