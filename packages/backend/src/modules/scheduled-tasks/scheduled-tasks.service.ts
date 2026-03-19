import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, MoreThan } from 'typeorm';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import {
  ExpiryAlert,
  ExpiryAlertStatus,
} from '../../database/entities/inventory.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Provider } from '../../database/entities/provider.entity';
import { User } from '../../database/entities/user.entity';
import { InAppNotification, InAppNotificationType } from '../../database/entities/in-app-notification.entity';

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
    @InjectRepository(Provider)
    private readonly providerRepo: Repository<Provider>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(InAppNotification)
    private readonly notificationRepo: Repository<InAppNotification>,
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

  /**
   * Check for expiring provider licenses daily at 8 AM.
   * Creates in-app notifications for providers with licenses expiring within 60 days.
   */
  @Cron('0 8 * * *', { name: 'check-license-expiry' })
  async checkLicenseExpiry() {
    this.logger.log('Running license expiry check...');
    try {
      const now = new Date();
      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(now.getDate() + 60);

      const providers = await this.providerRepo
        .createQueryBuilder('provider')
        .where('provider.license_expiry IS NOT NULL')
        .andWhere('provider.license_expiry <= :expiry', { expiry: sixtyDaysFromNow })
        .andWhere('provider.license_expiry > :now', { now })
        .andWhere('provider.status = :status', { status: 'active' })
        .andWhere('provider.deleted_at IS NULL')
        .getMany();

      this.logger.log(`Found ${providers.length} providers with licenses expiring within 60 days`);

      for (const provider of providers) {
        const daysUntilExpiry = Math.ceil(
          ((provider.licenseExpiry as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Check if notification already sent for this provider recently
        const targetUserId = provider.userId;
        if (!targetUserId) continue;

        try {
          const existingNotification = await this.notificationRepo
            .createQueryBuilder('n')
            .where('n.target_user_id = :userId', { userId: targetUserId })
            .andWhere('n.type = :type', { type: InAppNotificationType.GENERAL })
            .andWhere('n.title LIKE :title', { title: '%License Expiry%' })
            .andWhere('n.created_at > :since', { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) })
            .getOne();

          if (!existingNotification) {
            const notification = this.notificationRepo.create({
              targetUserId,
              type: InAppNotificationType.GENERAL,
              title: 'License Expiry Warning',
              message: `Your license (${provider.licenseNumber}) expires in ${daysUntilExpiry} days on ${(provider.licenseExpiry as Date).toISOString().split('T')[0]}. Please renew promptly.`,
              metadata: {
                providerId: provider.id,
                licenseNumber: provider.licenseNumber,
                licenseExpiry: provider.licenseExpiry,
                daysUntilExpiry,
              },
              tenantId: provider.tenantId,
              facilityId: provider.facilityId,
            });
            await this.notificationRepo.save(notification);
          }
        } catch (e) {
          this.logger.warn(`Failed to create license expiry notification for provider ${provider.id}: ${(e as Error).message}`);
        }
      }

      this.logger.log('License expiry check completed');
    } catch (error) {
      this.logger.error(
        'License expiry check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Monthly leave accrual on the 1st of each month at midnight.
   * Adds monthly leave accrual for active users.
   */
  @Cron('0 0 1 * *', { name: 'monthly-leave-accrual' })
  async monthlyLeaveAccrual() {
    this.logger.log('Running monthly leave accrual...');
    try {
      const now = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Get active users with hire dates past probation period (3 months)
      const users = await this.userRepo
        .createQueryBuilder('user')
        .where('user.status = :status', { status: 'active' })
        .andWhere('user.hire_date IS NOT NULL')
        .andWhere('user.hire_date <= :probationCutoff', { probationCutoff: threeMonthsAgo })
        .andWhere('user.deleted_at IS NULL')
        .getMany();

      this.logger.log(`Processing leave accrual for ${users.length} eligible users`);

      const annualMonthlyAccrual = 21 / 12; // 1.75 days per month
      const sickMonthlyAccrual = 10 / 12;   // ~0.83 days per month
      const maxAnnualBalance = 42;           // 2 years cap
      const maxSickBalance = 20;             // 2 years cap

      let updatedCount = 0;
      for (const user of users) {
        const newAnnual = Math.min(
          (user.annualLeaveBalance || 0) + annualMonthlyAccrual,
          maxAnnualBalance,
        );
        const newSick = Math.min(
          (user.sickLeaveBalance || 0) + sickMonthlyAccrual,
          maxSickBalance,
        );

        if (newAnnual !== user.annualLeaveBalance || newSick !== user.sickLeaveBalance) {
          user.annualLeaveBalance = Math.round(newAnnual * 100) / 100;
          user.sickLeaveBalance = Math.round(newSick * 100) / 100;
          await this.userRepo.save(user);
          updatedCount++;
        }
      }

      this.logger.log(`Leave accrual completed. Updated ${updatedCount} of ${users.length} users`);
    } catch (error) {
      this.logger.error(
        'Monthly leave accrual failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
