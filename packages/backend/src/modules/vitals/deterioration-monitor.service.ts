import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Queue, QueueStatus, QueuePriority } from '../../database/entities/queue.entity';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface DeteriorationEvent {
  vitalId: string;
  patientId: string;
  encounterId?: string;
  newsScore: number;
  previousNewsScore?: number;
  clinicalRiskLevel: string;
  tenantId?: string;
  facilityId?: string;
}

@Injectable()
export class DeteriorationMonitorService {
  private readonly logger = new Logger(DeteriorationMonitorService.name);

  constructor(
    @InjectRepository(Queue)
    private readonly queueRepo: Repository<Queue>,
    @InjectRepository(Vital)
    private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    private readonly notifications: InAppNotificationsService,
  ) {}

  /**
   * Handles vital.deterioration events emitted by VitalsService when NEWS >= 5.
   * Auto-escalates queue priority and notifies charge nurse.
   */
  @OnEvent('vital.deterioration')
  async handleDeteriorationEvent(payload: DeteriorationEvent): Promise<void> {
    try {
      const { patientId, newsScore, tenantId, facilityId } = payload;
      const tid = requireTenantId(tenantId);

      // Find the patient's active queue entry
      const activeQueue = await this.queueRepo.findOne({
        where: {
          patientId,
          status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
          tenantId: tid,
        },
        order: { createdAt: 'DESC' },
      });

      if (!activeQueue) return;

      // Determine target priority based on NEWS score
      let targetPriority: QueuePriority;
      if (newsScore >= 7) {
        targetPriority = QueuePriority.EMERGENCY;
      } else if (newsScore >= 5) {
        targetPriority = QueuePriority.URGENT;
      } else {
        return; // No escalation needed
      }

      // Only escalate if current priority is lower (higher number = lower priority)
      if (activeQueue.priority <= targetPriority) return;

      const oldPriority = activeQueue.priority;
      activeQueue.priority = targetPriority;
      activeQueue.priorityReason = `Auto-escalated: NEWS score ${newsScore} (${payload.clinicalRiskLevel} risk)`;
      activeQueue.lastEscalatedAt = new Date();
      activeQueue.escalationCount = (activeQueue.escalationCount || 0) + 1;

      await this.queueRepo.save(activeQueue);

      this.logger.warn(
        `Patient ${patientId} escalated from priority ${oldPriority} to ${targetPriority} (NEWS=${newsScore})`,
      );

      // Notify charge nurse via in-app notification
      try {
        const nurseIds = await this.notifications
          .getUserIdsByRole(
            ['charge_nurse', 'nurse_supervisor', 'nurse'],
            activeQueue.facilityId,
            tenantId,
          )
          .catch(() => [] as string[]);
        const targets = [...new Set(nurseIds)].filter(Boolean);
        if (targets.length > 0) {
          await this.notifications.notifyMany(
            targets,
            {
              type: InAppNotificationType.GENERAL,
              title: 'Patient Deterioration Alert',
              message: `Patient in queue ${activeQueue.ticketNumber} has NEWS score ${newsScore} (${payload.clinicalRiskLevel} risk). Priority auto-escalated to ${targetPriority === QueuePriority.EMERGENCY ? 'EMERGENCY' : 'URGENT'}.`,
              metadata: {
                kind: 'deterioration_escalation',
                queueId: activeQueue.id,
                patientId,
                newsScore,
                clinicalRiskLevel: payload.clinicalRiskLevel,
                previousPriority: oldPriority,
                newPriority: targetPriority,
              },
            },
            tenantId,
          );
        }
      } catch (e: any) {
        this.logger.warn(`Notification failed for deterioration: ${e?.message}`);
      }
    } catch (err: any) {
      this.logger.error(`Deterioration handler failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Cron: every 10 minutes, check waiting patients who have been waiting > 60 min
   * without reassessment and had NEWS >= 3.
   */
  @Cron('*/10 * * * *')
  async checkStaleWaitingPatients(): Promise<void> {
    try {
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find WAITING queues created > 60 min ago. Skip entries alerted in the
      // last hour (lastEscalatedAt) — this cron runs every 10 minutes and used
      // to re-notify the same nurses about the same patient on every tick.
      const staleQueues = await this.queueRepo
        .createQueryBuilder('q')
        .where('q.status = :status', { status: QueueStatus.WAITING })
        .andWhere('q.created_at < :cutoff', { cutoff: sixtyMinAgo })
        .andWhere('q.on_hold = false')
        .andWhere('(q.last_escalated_at IS NULL OR q.last_escalated_at < :cutoff)', {
          cutoff: sixtyMinAgo,
        })
        .getMany();

      if (staleQueues.length === 0) return;

      for (const queue of staleQueues) {
        // Check if last vital for this patient had NEWS >= 3
        const lastVital = await this.vitalRepo.findOne({
          where: { patientId: queue.patientId },
          order: { recordedAt: 'DESC' },
        });

        if (!lastVital?.newsScore || lastVital.newsScore < 3) continue;

        // Check if triage reassessment happened since the last vital
        const lastReassessmentTime = queue.triageDataUpdatedAt;
        if (lastReassessmentTime && lastReassessmentTime > lastVital.recordedAt) continue;

        this.logger.warn(
          `Stale waiting patient ${queue.patientId} (ticket ${queue.ticketNumber}): ` +
            `NEWS=${lastVital.newsScore}, waiting since ${queue.createdAt.toISOString()}`,
        );

        try {
          const nurseIds = await this.notifications
            .getUserIdsByRole(
              ['charge_nurse', 'nurse_supervisor', 'nurse'],
              queue.facilityId,
              queue.tenantId,
            )
            .catch(() => [] as string[]);
          const targets = [...new Set(nurseIds)].filter(Boolean);
          if (targets.length > 0) {
            await this.notifications.notifyMany(
              targets,
              {
                type: InAppNotificationType.GENERAL,
                title: 'Triage Reassessment Needed',
                message: `Patient ${queue.ticketNumber} has been waiting > 60 min with NEWS score ${lastVital.newsScore}. Please reassess.`,
                metadata: {
                  kind: 'stale_waiting_alert',
                  queueId: queue.id,
                  patientId: queue.patientId,
                  newsScore: lastVital.newsScore,
                  waitingSince: queue.createdAt.toISOString(),
                },
              },
              queue.tenantId,
            );
          }
        } catch (e: any) {
          this.logger.warn(`Stale patient notification failed: ${e?.message}`);
        }

        // Mark as alerted so the next ticks don't re-notify for an hour.
        await this.queueRepo
          .update(queue.id, { lastEscalatedAt: new Date() })
          .catch((e) => this.logger.warn(`Failed to stamp lastEscalatedAt: ${e?.message}`));
      }
    } catch (err: any) {
      this.logger.error(`Stale waiting check failed: ${err?.message}`, err?.stack);
    }
  }
}
