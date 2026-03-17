import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DrugClassification,
  DrugInteraction,
} from '../../database/entities/drug-classification.entity';
import {
  DrugSyncLog,
  SyncType,
  SyncStatus,
} from '../../database/entities/drug-sync-log.entity';
import { OpenFDAService } from '../integrations/openfda.service';

@Injectable()
export class DrugDbSyncService {
  private readonly logger = new Logger(DrugDbSyncService.name);

  constructor(
    @InjectRepository(DrugClassification)
    private readonly drugClassRepo: Repository<DrugClassification>,
    @InjectRepository(DrugInteraction)
    private readonly interactionRepo: Repository<DrugInteraction>,
    @InjectRepository(DrugSyncLog)
    private readonly syncLogRepo: Repository<DrugSyncLog>,
    private readonly openFdaService: OpenFDAService,
  ) {}

  /**
   * Sync drug interactions from OpenFDA for all drugs in the local database
   */
  async syncDrugInteractions(tenantId: string): Promise<DrugSyncLog> {
    const log = this.syncLogRepo.create({
      syncType: SyncType.INTERACTIONS,
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
      tenantId,
    });
    await this.syncLogRepo.save(log);

    try {
      // Get all local drugs with generic names
      const localDrugs = await this.drugClassRepo.find({
        where: { tenantId },
        select: ['id', 'genericName', 'brandName'],
      });

      const drugNames = localDrugs
        .map((d) => d.genericName || d.brandName)
        .filter(Boolean) as string[];

      let recordsProcessed = 0;
      let recordsAdded = 0;
      let recordsFailed = 0;

      // Check interactions for drug pairs via OpenFDA
      const batchSize = 5;
      for (let i = 0; i < drugNames.length; i += batchSize) {
        const batch = drugNames.slice(i, i + batchSize);
        try {
          const result = await this.openFdaService.checkDrugInteractions(batch);
          recordsProcessed += batch.length;

          for (const interaction of result.interactions) {
            try {
              // Find the local drug IDs
              const drugA = localDrugs.find(
                (d) =>
                  (d.genericName || '').toLowerCase() === interaction.drug1.toLowerCase() ||
                  (d.brandName || '').toLowerCase() === interaction.drug1.toLowerCase(),
              );
              const drugB = localDrugs.find(
                (d) =>
                  (d.genericName || '').toLowerCase() === interaction.drug2.toLowerCase() ||
                  (d.brandName || '').toLowerCase() === interaction.drug2.toLowerCase(),
              );

              if (!drugA || !drugB) continue;

              // Check if interaction already exists
              const existing = await this.interactionRepo.findOne({
                where: [
                  { drugAId: drugA.id, drugBId: drugB.id, tenantId },
                  { drugAId: drugB.id, drugBId: drugA.id, tenantId },
                ],
              });

              if (!existing) {
                const severityMap: Record<string, string> = {
                  low: 'minor',
                  moderate: 'moderate',
                  high: 'major',
                };

                await this.interactionRepo.save(
                  this.interactionRepo.create({
                    drugAId: drugA.id,
                    drugBId: drugB.id,
                    severity: severityMap[interaction.severity] || 'moderate',
                    description: interaction.description,
                    reference: 'OpenFDA',
                    isActive: true,
                    tenantId,
                  }),
                );
                recordsAdded++;
              }
            } catch (err) {
              recordsFailed++;
              this.logger.warn(`Failed to save interaction: ${err.message}`);
            }
          }
        } catch (err) {
          recordsFailed += batch.length;
          this.logger.warn(`Batch interaction check failed: ${err.message}`);
        }
      }

      log.status = SyncStatus.COMPLETED;
      log.recordsProcessed = recordsProcessed;
      log.recordsAdded = recordsAdded;
      log.recordsFailed = recordsFailed;
      log.completedAt = new Date();
      await this.syncLogRepo.save(log);

      return log;
    } catch (error) {
      log.status = SyncStatus.FAILED;
      log.errorMessage = error.message;
      log.completedAt = new Date();
      await this.syncLogRepo.save(log);
      throw error;
    }
  }

  /**
   * Fetch and store FDA label data for a specific drug
   */
  async syncDrugLabels(drugName: string, tenantId: string): Promise<DrugSyncLog> {
    const log = this.syncLogRepo.create({
      syncType: SyncType.LABELS,
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
      tenantId,
    });
    await this.syncLogRepo.save(log);

    try {
      const labels = await this.openFdaService.searchDrugs(drugName, 5);
      let recordsProcessed = 0;
      let recordsAdded = 0;
      let recordsFailed = 0;

      for (const label of labels) {
        recordsProcessed++;
        try {
          // Find matching local drug
          const localDrug = await this.drugClassRepo.findOne({
            where: [
              { genericName: label.genericName, tenantId },
              { brandName: label.brandName, tenantId },
            ],
          });

          if (localDrug) {
            // Update with FDA label data
            await this.drugClassRepo.update(localDrug.id, {
              contraindications: label.contraindications || localDrug.contraindications,
              warnings: label.warnings || localDrug.warnings,
              notes: localDrug.notes
                ? localDrug.notes
                : `FDA Label: ${label.indications}`.substring(0, 2000),
            });
            recordsAdded++;
          }
        } catch (err) {
          recordsFailed++;
          this.logger.warn(`Failed to sync label for ${label.genericName}: ${err.message}`);
        }
      }

      log.status = SyncStatus.COMPLETED;
      log.recordsProcessed = recordsProcessed;
      log.recordsAdded = recordsAdded;
      log.recordsFailed = recordsFailed;
      log.completedAt = new Date();
      await this.syncLogRepo.save(log);

      return log;
    } catch (error) {
      log.status = SyncStatus.FAILED;
      log.errorMessage = error.message;
      log.completedAt = new Date();
      await this.syncLogRepo.save(log);
      throw error;
    }
  }

  /**
   * Get current sync status for a tenant
   */
  async getSyncStatus(tenantId: string) {
    const lastSync = await this.syncLogRepo.findOne({
      where: { tenantId, status: SyncStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });

    const runningSync = await this.syncLogRepo.findOne({
      where: { tenantId, status: SyncStatus.RUNNING },
      order: { startedAt: 'DESC' },
    });

    const totalInteractions = await this.interactionRepo.count({
      where: { tenantId },
    });

    const totalDrugs = await this.drugClassRepo.count({
      where: { tenantId },
    });

    return {
      lastSyncDate: lastSync?.completedAt || null,
      lastSyncType: lastSync?.syncType || null,
      lastSyncRecordsAdded: lastSync?.recordsAdded || 0,
      isRunning: !!runningSync,
      runningSyncType: runningSync?.syncType || null,
      totalInteractions,
      totalDrugs,
    };
  }

  /**
   * Get sync history log
   */
  async getLastSyncLog(tenantId: string) {
    return this.syncLogRepo.find({
      where: { tenantId },
      order: { startedAt: 'DESC' },
      take: 50,
    });
  }
}
