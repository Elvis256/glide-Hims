import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import {
  ExpiryAlert,
  ExpiryAlertStatus,
} from '../../database/entities/inventory.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    @InjectRepository(BatchStockBalance)
    private readonly batchStockRepo: Repository<BatchStockBalance>,
    @InjectRepository(ExpiryAlert)
    private readonly expiryAlertRepo: Repository<ExpiryAlert>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  /**
   * Check for expiring medications daily at 7 AM.
   * Creates ExpiryAlert records for batches expiring within 30 days.
   */
  @Cron('0 7 * * *', { name: 'check-medication-expiry' })
  async checkMedicationExpiry() {
    this.logger.log('Running medication expiry check...');
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const batches = await this.batchStockRepo
        .createQueryBuilder('batch')
        .where('batch.expiry_date <= :expiry', { expiry: thirtyDaysFromNow })
        .andWhere('batch.expiry_date > :now', { now })
        .andWhere('batch.quantity > 0')
        .andWhere('batch.deleted_at IS NULL')
        .getMany();

      this.logger.log(
        `Found ${batches.length} batches expiring within 30 days`,
      );

      for (const batch of batches) {
        const existingAlert = await this.expiryAlertRepo.findOne({
          where: {
            itemId: batch.itemId,
            batchNumber: batch.batchNumber,
            status: ExpiryAlertStatus.ACTIVE,
          },
        });

        if (!existingAlert) {
          const daysUntilExpiry = Math.ceil(
            (batch.expiryDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          const alert = this.expiryAlertRepo.create({
            itemId: batch.itemId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            alertDate: now,
            quantity: Number(batch.quantity),
            status:
              daysUntilExpiry <= 7
                ? ExpiryAlertStatus.ACTIVE
                : ExpiryAlertStatus.NEAR_EXPIRY,
            facilityId: batch.facilityId,
          });

          await this.expiryAlertRepo.save(alert);
        }
      }

      this.logger.log('Medication expiry check completed');
    } catch (error) {
      this.logger.error(
        'Medication expiry check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Clean up old resolved sync conflicts weekly on Sunday at 2 AM.
   */
  @Cron('0 2 * * 0', { name: 'cleanup-old-sync-records' })
  async cleanupOldSyncRecords() {
    this.logger.log('Running sync record cleanup...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.batchStockRepo.manager.query(
        `DELETE FROM sync_conflicts WHERE status = 'resolved' AND updated_at < $1`,
        [thirtyDaysAgo],
      );

      this.logger.log(
        `Sync record cleanup completed. Removed ${result?.[1] || 0} old records`,
      );
    } catch (error) {
      this.logger.error(
        'Sync record cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Log daily system health summary at 6 AM.
   */
  @Cron('0 6 * * *', { name: 'daily-health-summary' })
  async dailyHealthSummary() {
    this.logger.log('Generating daily health summary...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointmentCount = await this.appointmentRepo.count({
        where: {
          appointmentDate: Between(today, tomorrow),
        },
      });

      const activeAlerts = await this.expiryAlertRepo.count({
        where: [
          { status: ExpiryAlertStatus.ACTIVE },
          { status: ExpiryAlertStatus.NEAR_EXPIRY },
        ],
      });

      this.logger.log(
        `Daily summary — Appointments today: ${appointmentCount}, Active expiry alerts: ${activeAlerts}`,
      );
    } catch (error) {
      this.logger.error(
        'Daily health summary failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
