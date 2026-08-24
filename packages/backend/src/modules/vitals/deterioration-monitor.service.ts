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
      if (newsScore < 5) return;

      // The patient's OPD queue entry, IF they have one. This whole handler
      // used to return here when they did not — and the notification lived
      // inside that branch. So a NEWS score only ever reached anybody for an
      // outpatient holding a queue ticket: every inpatient, every woman in
      // labour and every patient in the emergency department was invisible to
      // it. A ward patient charted at RR 25, SpO2 92 on oxygen scores NEWS 7 —
      // "high risk, emergency assessment" — with no single value abnormal
      // enough to trip the critical-vital alert either, so nobody was told at
      // all. Escalating the queue is now one optional consequence; telling
      // somebody is unconditional.
      const activeQueue = await this.queueRepo.findOne({
        where: {
          patientId,
          status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
          tenantId: tid,
        },
        order: { createdAt: 'DESC' },
      });

      const targetPriority =
        newsScore >= 7 ? QueuePriority.EMERGENCY : QueuePriority.URGENT;
      let escalated = false;
      let oldPriority: QueuePriority | undefined;

      // Only escalate if current priority is lower (higher number = lower priority)
      if (activeQueue && activeQueue.priority > targetPriority) {
        oldPriority = activeQueue.priority;
        activeQueue.priority = targetPriority;
        activeQueue.priorityReason = `Auto-escalated: NEWS score ${newsScore} (${payload.clinicalRiskLevel} risk)`;
        activeQueue.lastEscalatedAt = new Date();
        activeQueue.escalationCount = (activeQueue.escalationCount || 0) + 1;
        await this.queueRepo.save(activeQueue);
        escalated = true;

        this.logger.warn(
          `Patient ${patientId} escalated from priority ${oldPriority} to ${targetPriority} (NEWS=${newsScore})`,
        );
      }

      await this.notifyDeterioration(payload, tid, activeQueue, escalated, oldPriority);
    } catch (err: any) {
      this.logger.error(`Deterioration handler failed: ${err?.message}`, err?.stack);
    }
  }

  /** Tell the ward. Never throws — an alert that cannot be delivered must not
   *  roll back the observation that triggered it. */
  private async notifyDeterioration(
    payload: DeteriorationEvent,
    tenantId: string,
    activeQueue: Queue | null,
    escalated: boolean,
    oldPriority?: QueuePriority,
  ): Promise<void> {
    const { patientId, newsScore, encounterId } = payload;
    try {
      const facilityId = activeQueue?.facilityId || payload.facilityId;

      // A NEWS of 7 or more is "urgent or emergency response" in NEWS2 terms —
      // a nurse alone cannot provide that, so doctors are told as well.
      const roles =
        newsScore >= 7
          ? ['charge_nurse', 'nurse_supervisor', 'nurse', 'doctor', 'medical_officer']
          : ['charge_nurse', 'nurse_supervisor', 'nurse'];

      const targets = new Set<string>(
        await this.notifications
          .getUserIdsByRole(roles, facilityId, tenantId)
          .catch(() => [] as string[]),
      );

      // Whoever is actually looking after this patient, wherever they are.
      if (encounterId) {
        const encounter = await this.encounterRepo
          .findOne({ where: { id: encounterId }, select: ['id', 'attendingProviderId'] })
          .catch(() => null);
        if (encounter?.attendingProviderId) targets.add(encounter.attendingProviderId);
      }

      const recipients = [...targets].filter(Boolean);
      if (recipients.length === 0) {
        this.logger.warn(
          `NEWS ${newsScore} for patient ${patientId} but no recipient could be resolved`,
        );
        return;
      }

      const where = activeQueue
        ? `in queue ${activeQueue.ticketNumber}`
        : 'on the ward';
      const escalation = escalated
        ? ` Priority auto-escalated to ${payload.newsScore >= 7 ? 'EMERGENCY' : 'URGENT'}.`
        : '';

      await this.notifications.notifyMany(
        recipients,
        {
          type: InAppNotificationType.GENERAL,
          title: newsScore >= 7 ? 'URGENT: Patient Deterioration' : 'Patient Deterioration Alert',
          message: `Patient ${where} has NEWS score ${newsScore} (${payload.clinicalRiskLevel} risk).${escalation}`,
          facilityId,
          metadata: {
            kind: 'deterioration_escalation',
            queueId: activeQueue?.id ?? null,
            patientId,
            encounterId: encounterId ?? null,
            newsScore,
            clinicalRiskLevel: payload.clinicalRiskLevel,
            previousPriority: oldPriority ?? null,
            newPriority: escalated ? (newsScore >= 7 ? QueuePriority.EMERGENCY : QueuePriority.URGENT) : null,
          },
        },
        tenantId,
      );
    } catch (e: any) {
      this.logger.warn(`Notification failed for deterioration: ${e?.message}`);
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
        // Scoped to the queue's own tenant: this cron runs cross-tenant in
        // system context, where an unscoped read is not held back by RLS.
        const lastVital = await this.vitalRepo.findOne({
          where: { patientId: queue.patientId, tenantId: queue.tenantId },
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
