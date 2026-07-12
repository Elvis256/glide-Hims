import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, MoreThan } from 'typeorm';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';
import {
  ExpiryAlert,
  ExpiryAlertStatus,
  AlertLevel,
} from '../../database/entities/inventory.entity';
import { Appointment, AppointmentStatus } from '../appointments/entities/appointment.entity';
import { Provider } from '../../database/entities/provider.entity';
import { User } from '../../database/entities/user.entity';
import {
  InAppNotification,
  InAppNotificationType,
} from '../../database/entities/in-app-notification.entity';
import { Facility } from '../../database/entities/facility.entity';
import {
  ExpiryAlertConfig,
  ExpiryAlertHistory,
  AlertSeverity,
  AlertChannel,
} from '../../database/entities/expiry-alert.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification-config.entity';
import { Invoice, InvoiceStatus } from '../../database/entities/invoice.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Queue, QueueStatus } from '../../database/entities/queue.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';

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
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
    @InjectRepository(ExpiryAlertConfig)
    private readonly expiryAlertConfigRepo: Repository<ExpiryAlertConfig>,
    @InjectRepository(ExpiryAlertHistory)
    private readonly expiryAlertHistoryRepo: Repository<ExpiryAlertHistory>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    private readonly inAppNotificationsService: InAppNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Check for expiring drugs daily at 7 AM.
   * Queries all active facilities, finds items expiring within 30/60/90 days,
   * creates ExpiryAlert records, sends in-app notifications and SMS for urgent items.
   */
  @Cron('0 7 * * *', { name: 'check-expiring-drugs' })
  async checkExpiringDrugs() {
    this.logger.log('Running daily drug expiry alert check...');

    let facilitiesChecked = 0;
    let totalExpiringItems = 0;
    let totalAlertsSent = 0;

    try {
      const facilities = await this.facilityRepo
        .createQueryBuilder('facility')
        .where('facility.status = :status', { status: 'active' })
        .andWhere('facility.deleted_at IS NULL')
        .getMany();

      this.logger.log(`Found ${facilities.length} active facilities to check`);

      for (const facility of facilities) {
        try {
          const result = await this.processExpiringDrugsForFacility(facility);
          facilitiesChecked++;
          totalExpiringItems += result.expiringItems;
          totalAlertsSent += result.alertsSent;
        } catch (error) {
          this.logger.error(
            `Drug expiry check failed for facility ${facility.name} (${facility.id})`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Drug expiry check completed — Checked ${facilitiesChecked} facilities, ` +
          `found ${totalExpiringItems} expiring items, sent ${totalAlertsSent} alerts`,
      );
    } catch (error) {
      this.logger.error(
        'Drug expiry alert check failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async processExpiringDrugsForFacility(
    facility: Facility,
  ): Promise<{ expiringItems: number; alertsSent: number }> {
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);

    const batches = await this.batchStockRepo
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.item', 'item')
      .where('batch.facility_id = :facilityId', { facilityId: facility.id })
      .andWhere('batch.expiry_date <= :expiry', { expiry: ninetyDaysFromNow })
      .andWhere('batch.expiry_date > :now', { now })
      .andWhere('batch.quantity > 0')
      .andWhere('batch.status = :status', { status: 'active' })
      .andWhere('batch.deleted_at IS NULL')
      .orderBy('batch.expiry_date', 'ASC')
      .getMany();

    if (batches.length === 0) return { expiringItems: 0, alertsSent: 0 };

    const urgentItems: BatchStockBalance[] = []; // ≤30 days
    const warningItems: BatchStockBalance[] = []; // 31–60 days
    const infoItems: BatchStockBalance[] = []; // 61–90 days

    for (const batch of batches) {
      const daysUntilExpiry = Math.ceil(
        (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let alertLevel: AlertLevel;
      let expiryStatus: ExpiryAlertStatus;

      if (daysUntilExpiry <= 30) {
        alertLevel = AlertLevel.URGENT;
        expiryStatus =
          daysUntilExpiry <= 7 ? ExpiryAlertStatus.ACTIVE : ExpiryAlertStatus.NEAR_EXPIRY;
        urgentItems.push(batch);
      } else if (daysUntilExpiry <= 60) {
        alertLevel = AlertLevel.WARNING;
        expiryStatus = ExpiryAlertStatus.NEAR_EXPIRY;
        warningItems.push(batch);
      } else {
        alertLevel = AlertLevel.INFO;
        expiryStatus = ExpiryAlertStatus.NEAR_EXPIRY;
        infoItems.push(batch);
      }

      // Create or update ExpiryAlert record
      const existingAlert = await this.expiryAlertRepo.findOne({
        where: {
          itemId: batch.itemId,
          batchNumber: batch.batchNumber,
          facilityId: facility.id,
        },
      });

      if (existingAlert) {
        existingAlert.daysUntilExpiry = daysUntilExpiry;
        existingAlert.alertLevel = alertLevel;
        existingAlert.quantity = Number(batch.quantity);
        existingAlert.status = expiryStatus;
        existingAlert.alertDate = now;
        await this.expiryAlertRepo.save(existingAlert);
      } else {
        const alert = this.expiryAlertRepo.create({
          itemId: batch.itemId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          alertDate: now,
          quantity: Number(batch.quantity),
          status: expiryStatus,
          alertLevel,
          daysUntilExpiry,
          facilityId: facility.id,
          tenantId: batch.tenantId,
        });
        await this.expiryAlertRepo.save(alert);
      }
    }

    let alertsSent = 0;

    // Send in-app notifications for urgent items (≤30 days)
    if (urgentItems.length > 0) {
      alertsSent += await this.sendExpiryInAppNotifications(
        facility,
        urgentItems,
        AlertLevel.URGENT,
        30,
      );
    }

    // Send in-app notifications for warning items (31–60 days)
    if (warningItems.length > 0) {
      alertsSent += await this.sendExpiryInAppNotifications(
        facility,
        warningItems,
        AlertLevel.WARNING,
        60,
      );
    }

    // Send SMS only for urgent items (≤30 days)
    if (urgentItems.length > 0) {
      alertsSent += await this.sendExpirySmsAlerts(facility, urgentItems);
    }

    // Record history for the facility
    await this.recordAlertHistory(
      facility,
      batches.length,
      urgentItems.length,
      warningItems.length,
      infoItems.length,
    );

    return { expiringItems: batches.length, alertsSent };
  }

  private async sendExpiryInAppNotifications(
    facility: Facility,
    items: BatchStockBalance[],
    level: AlertLevel,
    dayWindow: number,
  ): Promise<number> {
    try {
      const pharmacyUserIds = await this.inAppNotificationsService.getUserIdsByRole(
        ['pharmacist', 'pharmacy manager', 'pharmacy'],
        facility.id,
        facility.tenantId,
      );

      if (pharmacyUserIds.length === 0) return 0;

      const titlePrefix = level === AlertLevel.URGENT ? '🚨' : '⚠️';
      const typeLabel = level === AlertLevel.URGENT ? 'URGENT' : 'WARNING';
      const itemNames = items
        .slice(0, 5)
        .map((b) => b.item?.name || b.itemId)
        .join(', ');
      const suffix = items.length > 5 ? ` and ${items.length - 5} more` : '';

      await this.inAppNotificationsService.notifyMany(
        pharmacyUserIds,
        {
          type: InAppNotificationType.GENERAL,
          title: `${titlePrefix} Drug Expiry Alert — ${typeLabel}`,
          message: `${items.length} item(s) expiring within ${dayWindow} days at ${facility.name}: ${itemNames}${suffix}`,
          facilityId: facility.id,
          senderName: 'System — Drug Expiry Monitor',
          metadata: {
            alertLevel: level,
            dayWindow,
            facilityId: facility.id,
            facilityName: facility.name,
            itemCount: items.length,
            items: items.slice(0, 10).map((b) => ({
              itemId: b.itemId,
              itemName: b.item?.name,
              batchNumber: b.batchNumber,
              expiryDate: b.expiryDate,
              quantity: Number(b.quantity),
            })),
          },
        },
        facility.tenantId,
      );

      // Mark alerts as in-app sent
      await this.expiryAlertRepo
        .createQueryBuilder()
        .update(ExpiryAlert)
        .set({ inAppSent: true })
        .where('facility_id = :facilityId', { facilityId: facility.id })
        .andWhere('alert_level = :level', { level })
        .andWhere('in_app_sent = false')
        .execute();

      return pharmacyUserIds.length;
    } catch (error) {
      this.logger.warn(
        `Failed to send in-app expiry notifications for facility ${facility.name}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private async sendExpirySmsAlerts(
    facility: Facility,
    urgentItems: BatchStockBalance[],
  ): Promise<number> {
    try {
      const smsConfigs = await this.notificationsService.getConfig(
        facility.id,
        NotificationType.SMS,
        facility.tenantId,
      );

      const smsConfig = smsConfigs.find((c) => c.isEnabled);
      if (!smsConfig) return 0;

      // Check facility-level expiry alert config for phone numbers
      const alertConfig = await this.expiryAlertConfigRepo.findOne({
        where: { facilityId: facility.id, isActive: true },
      });

      const phones = alertConfig?.notifyPhones;
      if (!phones || phones.length === 0) return 0;

      const itemNames = urgentItems
        .slice(0, 3)
        .map((b) => b.item?.name || b.batchNumber)
        .join(', ');
      const suffix = urgentItems.length > 3 ? ` +${urgentItems.length - 3} more` : '';
      const message =
        `URGENT: ${urgentItems.length} drug(s) expiring within 30 days at ${facility.name}. ` +
        `Items: ${itemNames}${suffix}. Please take action.`;

      let smsSentCount = 0;
      for (const phone of phones) {
        try {
          await this.notificationsService.sendSms(smsConfig, phone, message);
          smsSentCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to send expiry SMS to ${phone} for facility ${facility.name}: ${(error as Error).message}`,
          );
        }
      }

      // Mark alerts as SMS sent
      if (smsSentCount > 0) {
        await this.expiryAlertRepo
          .createQueryBuilder()
          .update(ExpiryAlert)
          .set({ smsSent: true })
          .where('facility_id = :facilityId', { facilityId: facility.id })
          .andWhere('alert_level = :level', { level: AlertLevel.URGENT })
          .andWhere('sms_sent = false')
          .execute();
      }

      return smsSentCount;
    } catch (error) {
      this.logger.warn(
        `Failed to send expiry SMS alerts for facility ${facility.name}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private async recordAlertHistory(
    facility: Facility,
    totalItems: number,
    urgentCount: number,
    warningCount: number,
    infoCount: number,
  ): Promise<void> {
    try {
      let severity = AlertSeverity.LOW;
      if (urgentCount > 0) severity = AlertSeverity.CRITICAL;
      else if (warningCount > 0) severity = AlertSeverity.HIGH;
      else if (infoCount > 0) severity = AlertSeverity.MEDIUM;

      const history = this.expiryAlertHistoryRepo.create({
        alertType: 'drug_expiry_daily',
        itemsAffected: totalItems,
        severity,
        message: `Daily check: ${urgentCount} urgent (≤30d), ${warningCount} warning (31-60d), ${infoCount} info (61-90d)`,
        channel: AlertChannel.IN_APP,
        sentAt: new Date(),
        facilityId: facility.id,
        tenantId: facility.tenantId,
      });

      await this.expiryAlertHistoryRepo.save(history);
    } catch (error) {
      this.logger.warn(
        `Failed to record alert history for facility ${facility.name}: ${(error as Error).message}`,
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
        `DELETE FROM sync_conflicts WHERE resolution <> 'pending' AND updated_at < $1`,
        [thirtyDaysAgo],
      );

      this.logger.log(`Sync record cleanup completed. Removed ${result?.[1] || 0} old records`);
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
        where: [{ status: ExpiryAlertStatus.ACTIVE }, { status: ExpiryAlertStatus.NEAR_EXPIRY }],
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
            .andWhere('n.created_at > :since', {
              since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            })
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
          this.logger.warn(
            `Failed to create license expiry notification for provider ${provider.id}: ${(e as Error).message}`,
          );
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
      const sickMonthlyAccrual = 10 / 12; // ~0.83 days per month
      const maxAnnualBalance = 42; // 2 years cap
      const maxSickBalance = 20; // 2 years cap

      let updatedCount = 0;
      for (const user of users) {
        const newAnnual = Math.min(
          (user.annualLeaveBalance || 0) + annualMonthlyAccrual,
          maxAnnualBalance,
        );
        const newSick = Math.min((user.sickLeaveBalance || 0) + sickMonthlyAccrual, maxSickBalance);

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

  /**
   * Send appointment reminders daily at 8 AM.
   * Queries all SCHEDULED/CONFIRMED appointments for the next day across all facilities,
   * sends in-app notifications to both patient (if they have a user account) and the
   * assigned doctor, and attempts an SMS to the patient's phone number.
   */
  @Cron('0 8 * * *', { name: 'appointment-reminders' })
  async sendAppointmentReminders() {
    this.logger.log('Running appointment reminder job...');

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const appointments = await this.appointmentRepo.find({
        where: [
          {
            status: AppointmentStatus.SCHEDULED,
            appointmentDate: Between(tomorrow, dayAfterTomorrow),
          },
          {
            status: AppointmentStatus.CONFIRMED,
            appointmentDate: Between(tomorrow, dayAfterTomorrow),
          },
        ],
        relations: ['patient', 'doctor', 'facility'],
      });

      this.logger.log(`Found ${appointments.length} appointment(s) to remind for tomorrow`);

      let inAppSent = 0;
      let smsSent = 0;
      let failed = 0;

      for (const appt of appointments) {
        try {
          const dateStr = (appt.appointmentDate as unknown as string).toString().slice(0, 10);
          const doctorName = appt.doctor
            ? `Dr. ${appt.doctor.fullName || ''}`.trim()
            : 'your doctor';
          const facilityName = appt.facility?.name || 'the facility';

          // Notify patient if they have a linked user account
          const patientUserId = appt.patient?.userId;
          if (patientUserId) {
            const notification = this.notificationRepo.create({
              targetUserId: patientUserId,
              type: InAppNotificationType.GENERAL,
              title: '📅 Appointment Reminder',
              message: `You have an appointment with ${doctorName} at ${facilityName} tomorrow (${dateStr}) at ${appt.startTime}. Please arrive 15 minutes early.`,
              metadata: {
                appointmentId: appt.id,
                appointmentDate: dateStr,
                startTime: appt.startTime,
                doctorId: appt.doctorId,
              },
              facilityId: appt.facilityId,
              tenantId: appt.facility?.tenantId,
            });
            await this.notificationRepo.save(notification);
            inAppSent++;
          }

          // Notify the doctor
          if (appt.doctorId) {
            const patientName = appt.patient?.fullName || 'a patient';
            const doctorNotification = this.notificationRepo.create({
              targetUserId: appt.doctorId,
              type: InAppNotificationType.GENERAL,
              title: '📅 Upcoming Appointment',
              message: `Reminder: you have an appointment with ${patientName} tomorrow (${dateStr}) at ${appt.startTime}.`,
              metadata: {
                appointmentId: appt.id,
                appointmentDate: dateStr,
                startTime: appt.startTime,
                patientId: appt.patientId,
              },
              facilityId: appt.facilityId,
              tenantId: appt.facility?.tenantId,
            });
            await this.notificationRepo.save(doctorNotification);
            inAppSent++;
          }

          // SMS to patient phone if available
          const patientPhone = appt.patient?.phone;
          if (patientPhone) {
            try {
              const smsConfigs = await this.notificationsService.getConfig(
                appt.facilityId,
                NotificationType.SMS,
                appt.facility?.tenantId,
              );
              const smsConfig = smsConfigs.find((c) => c.isEnabled);
              if (smsConfig) {
                const smsText =
                  `Reminder: Your appointment with ${doctorName} at ${facilityName} is tomorrow ` +
                  `(${dateStr}) at ${appt.startTime}. Please arrive 15 minutes early. ` +
                  `Call us if you need to reschedule.`;
                await this.notificationsService.sendSms(smsConfig, patientPhone, smsText);
                smsSent++;
              }
            } catch (smsError) {
              this.logger.warn(
                `Failed to send appointment reminder SMS to ${patientPhone} for appointment ${appt.id}: ${(smsError as Error).message}`,
              );
            }
          }
        } catch (apptError) {
          this.logger.warn(
            `Failed to send reminders for appointment ${appt.id}: ${(apptError as Error).message}`,
          );
          failed++;
        }
      }

      this.logger.log(
        `Appointment reminders complete — ${appointments.length} appointments processed, ` +
          `${inAppSent} in-app notifications sent, ${smsSent} SMS sent, ${failed} failed`,
      );
    } catch (error) {
      this.logger.error(
        'Appointment reminder job failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * T-2h appointment reminders. Runs every 30 minutes; finds confirmed/scheduled
   * appointments starting between now+90min and now+150min that have NOT yet
   * been short-reminded (tracked via metadata.shortReminderSentAt on InAppNotification).
   * Sends a short SMS to the patient. Idempotent — checks for an existing T-2h
   * notification record before sending.
   */
  @Cron('*/30 * * * *', { name: 'appointment-reminders-2h' })
  async sendShortAppointmentReminders() {
    try {
      const now = new Date();
      const lower = new Date(now.getTime() + 90 * 60 * 1000); // +90m
      const upper = new Date(now.getTime() + 150 * 60 * 1000); // +150m
      // appointmentDate is a date column; we filter by date == today/tomorrow then by startTime.
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(todayStart);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);

      const appointments = await this.appointmentRepo.find({
        where: [
          {
            status: AppointmentStatus.SCHEDULED,
            appointmentDate: Between(todayStart, tomorrowEnd),
          },
          {
            status: AppointmentStatus.CONFIRMED,
            appointmentDate: Between(todayStart, tomorrowEnd),
          },
        ],
        relations: ['patient', 'doctor', 'facility'],
      });

      let sent = 0;
      for (const appt of appointments) {
        try {
          const dateStr = (appt.appointmentDate as unknown as string).toString().slice(0, 10);
          const startTime = appt.startTime || '00:00';
          const fullStart = new Date(`${dateStr}T${startTime}`);
          if (Number.isNaN(fullStart.getTime())) continue;
          if (fullStart < lower || fullStart > upper) continue;

          // Idempotency guard: skip if a T-2h notification was already created
          const already = await this.notificationRepo.findOne({
            where: { type: InAppNotificationType.GENERAL, title: '⏰ Appointment Today (Soon)' },
            order: { createdAt: 'DESC' },
            relations: [],
          });
          // Use metadata appointmentId match instead
          const exists = await this.notificationRepo
            .createQueryBuilder('n')
            .where("n.metadata->>'appointmentId' = :id", { id: appt.id })
            .andWhere("n.metadata->>'shortReminder' = 'true'")
            .getOne();
          if (exists || already?.metadata?.appointmentId === appt.id) continue;

          const patient = appt.patient;
          const doctorName = appt.doctor
            ? `Dr. ${appt.doctor.fullName || ''}`.trim()
            : 'your doctor';
          const facName = appt.facility?.name || 'the facility';

          // SMS to patient
          if (patient?.phone && appt.facilityId) {
            await this.notificationsService.sendSmsToPatient({
              patient,
              facilityId: appt.facilityId,
              tenantId: appt.facility?.tenantId,
              message: `Reminder: Your appointment with ${doctorName} at ${facName} is at ${startTime} today. Please arrive 15 minutes early.`,
            });
            sent++;
          }

          // Audit notification (keeps idempotency state)
          if (patient?.userId) {
            await this.notificationRepo.save(
              this.notificationRepo.create({
                targetUserId: patient.userId,
                type: InAppNotificationType.GENERAL,
                title: '⏰ Appointment Today (Soon)',
                message: `Your appointment with ${doctorName} starts at ${startTime}.`,
                metadata: { appointmentId: appt.id, shortReminder: 'true' },
                facilityId: appt.facilityId,
                tenantId: appt.facility?.tenantId,
              }),
            );
          }
        } catch (e) {
          this.logger.warn(`T-2h reminder failed for appt ${appt.id}: ${(e as Error).message}`);
        }
      }
      if (sent > 0) this.logger.log(`T-2h appointment reminders sent: ${sent}`);
    } catch (error) {
      this.logger.error(
        'T-2h appointment reminder job failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Outstanding-balance reminders. Runs daily at 9 AM. For invoices that are
   * PENDING or PARTIALLY_PAID, older than 7 days, with a balance > 0, sends
   * the patient an SMS courtesy reminder. Throttled to once per 7 days per
   * invoice via metadata on an InAppNotification audit record.
   */
  @Cron('0 9 * * *', { name: 'outstanding-balance-reminders' })
  async sendOutstandingBalanceReminders() {
    this.logger.log('Running outstanding balance reminder job...');
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const invoices = await this.invoiceRepo
        .createQueryBuilder('inv')
        .leftJoinAndSelect('inv.patient', 'patient')
        .leftJoinAndSelect('inv.encounter', 'encounter')
        .leftJoinAndSelect('encounter.facility', 'facility')
        .where('inv.status IN (:...statuses)', {
          statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
        })
        .andWhere('inv.balance_due > 0')
        .andWhere('inv.created_at <= :cutoff', { cutoff: sevenDaysAgo })
        .andWhere('inv.deleted_at IS NULL')
        .getMany();

      let sent = 0;
      for (const inv of invoices) {
        try {
          const patient = inv.patient;
          const facilityId = inv.encounter?.facilityId;
          if (!patient?.phone || !facilityId) continue;

          // Throttle: once per 7 days per invoice
          const recent = await this.notificationRepo
            .createQueryBuilder('n')
            .where("n.metadata->>'invoiceId' = :id", { id: inv.id })
            .andWhere("n.metadata->>'balanceReminder' = 'true'")
            .andWhere('n.created_at >= :cutoff', { cutoff: sevenDaysAgo })
            .getOne();
          if (recent) continue;

          const facName = inv.encounter?.facility?.name || 'the facility';
          const fname = String(patient.fullName || 'patient').split(' ')[0];
          const balance = Number(inv.balanceDue || 0).toLocaleString();
          const msg =
            `Hello ${fname}, your invoice ${inv.invoiceNumber} at ${facName} has an ` +
            `outstanding balance of UGX ${balance}. Please settle at your earliest convenience.`;

          await this.notificationsService.sendSmsToPatient({
            patient,
            facilityId,
            tenantId: inv.tenantId,
            message: msg,
          });

          await this.notificationRepo.save(
            this.notificationRepo.create({
              targetUserId: patient.userId ?? undefined,
              type: InAppNotificationType.GENERAL,
              title: '💰 Outstanding Balance Reminder',
              message: msg,
              metadata: { invoiceId: inv.id, balanceReminder: 'true' },
              facilityId,
              tenantId: inv.tenantId,
            }),
          );
          sent++;
        } catch (e) {
          this.logger.warn(
            `Balance reminder failed for invoice ${inv.id}: ${(e as Error).message}`,
          );
        }
      }
      this.logger.log(
        `Outstanding balance reminders complete — ${invoices.length} invoices scanned, ${sent} SMS sent`,
      );
    } catch (error) {
      this.logger.error(
        'Outstanding balance reminder job failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Stale-queue sweeper. Every 15 minutes:
   *  - Finds queue entries still in WAITING / CALLED / PENDING_PAYMENT
   *  - Older than `QUEUE_AUTO_NO_SHOW_MINUTES` (env, default 480 = 8h since createdAt)
   *    OR with queue_date strictly before today
   *  - Marks them NO_SHOW with reason `auto: stale-sweep` and refreshes actualWaitMinutes.
   *
   * This eliminates the "patient parked in queue for days" footgun where reception/doctors
   * never click No-Show or Cancel and the queue never resets.
   */
  @Cron('*/15 * * * *', { name: 'queue-stale-sweep' })
  async sweepStaleQueueEntries(): Promise<void> {
    const cutoffMinutes = Number(process.env.QUEUE_AUTO_NO_SHOW_MINUTES || 480);
    const cutoff = new Date(Date.now() - cutoffMinutes * 60_000);
    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const stale = await this.queueRepo
        .createQueryBuilder('q')
        .where('q.status IN (:...statuses)', {
          statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.PENDING_PAYMENT],
        })
        .andWhere('q.on_hold = false')
        .andWhere('(q.created_at < :cutoff OR q.queue_date < :today)', {
          cutoff,
          today: todayStr,
        })
        .limit(500)
        .getMany();

      if (stale.length === 0) {
        return;
      }

      let marked = 0;
      for (const q of stale) {
        const prev = q.status;
        q.status = QueueStatus.NO_SHOW;
        const ageMin = Math.round((Date.now() - new Date(q.createdAt).getTime()) / 60_000);
        q.actualWaitMinutes = ageMin;
        q.skipReason = `auto: stale-sweep (${ageMin}m, prev=${prev})`;
        try {
          await this.queueRepo.save(q);
          marked++;
        } catch (e) {
          this.logger.warn(`Failed to auto-no-show queue ${q.id}: ${(e as Error).message}`);
        }
      }

      this.logger.log(
        `Queue stale-sweep: scanned ${stale.length}, auto-no-show ${marked} (cutoff=${cutoffMinutes}m)`,
      );
    } catch (error) {
      this.logger.error(
        'Queue stale-sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Auto-cancel stale encounters every 15 minutes.
   * Encounters in REGISTERED, TRIAGE, or WAITING status older than
   * ENCOUNTER_AUTO_CANCEL_MINUTES (env, default 480 = 8h) are cancelled
   * automatically to prevent indefinite parking.
   */
  @Cron('*/15 * * * *', { name: 'encounter-stale-sweep' })
  async sweepStaleEncounters(): Promise<void> {
    const cutoffMinutes = Number(process.env.ENCOUNTER_AUTO_CANCEL_MINUTES || 480);
    const cutoff = new Date(Date.now() - cutoffMinutes * 60_000);

    try {
      const stale = await this.encounterRepo
        .createQueryBuilder('e')
        .where('e.status IN (:...statuses)', {
          statuses: [EncounterStatus.REGISTERED, EncounterStatus.TRIAGE, EncounterStatus.WAITING],
        })
        .andWhere('e.created_at < :cutoff', { cutoff })
        .limit(500)
        .getMany();

      if (stale.length === 0) {
        return;
      }

      let cancelled = 0;
      const now = new Date();
      for (const encounter of stale) {
        encounter.status = EncounterStatus.CANCELLED;
        encounter.metadata = {
          ...encounter.metadata,
          autoCancelledAt: now.toISOString(),
          autoCancelReason: `Stale encounter auto-cancelled after ${cutoffMinutes} minutes`,
        };
        try {
          await this.encounterRepo.save(encounter);
          cancelled++;
        } catch (e) {
          this.logger.warn(
            `Failed to auto-cancel encounter ${encounter.id}: ${(e as Error).message}`,
          );
        }
      }

      this.logger.log(
        `Encounter stale-sweep: scanned ${stale.length}, auto-cancelled ${cancelled} (cutoff=${cutoffMinutes}m)`,
      );
    } catch (error) {
      this.logger.error(
        'Encounter stale-sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
