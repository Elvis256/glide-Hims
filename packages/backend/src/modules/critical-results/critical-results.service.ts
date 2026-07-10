import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CriticalResultAlert,
  CriticalResultResourceType,
  CriticalResultSeverity,
} from '../../database/entities/critical-result-alert.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

export interface FlagCriticalResultDto {
  resourceType: CriticalResultResourceType;
  resourceId: string;
  orderId?: string | null;
  patientId: string;
  encounterId?: string | null;
  severity: CriticalResultSeverity;
  summary?: string | null;
  flaggedById?: string | null;
  assignedToId?: string | null;
  tenantId?: string | null;
  /**
   * SLA window in minutes from flagged_at.
   * Defaults: critical_low/critical_high/critical = 30, abnormal = 240 (4h).
   */
  slaMinutes?: number;
}

export interface AcknowledgeCriticalResultDto {
  note: string;
  actionTaken?: string;
  followUpOrderId?: string;
}

const DEFAULT_SLA: Record<CriticalResultSeverity, number> = {
  critical_low: 30,
  critical_high: 30,
  critical: 30,
  abnormal: 240,
};

@Injectable()
export class CriticalResultsService {
  private readonly logger = new Logger(CriticalResultsService.name);

  constructor(
    @InjectRepository(CriticalResultAlert)
    private alertRepo: Repository<CriticalResultAlert>,
    private notifications: InAppNotificationsService,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Idempotently flag a finalised result as critical/abnormal. Safe to call
   * from validateResult / amendResult / createImagingResult — if an active
   * alert already exists for the same (resourceType, resourceId), it
   * updates severity if escalated and returns the existing row.
   */
  async flag(dto: FlagCriticalResultDto): Promise<CriticalResultAlert> {
    const tenantId = dto.tenantId ?? undefined;
    const existing = await this.alertRepo.findOne({
      where: {
        tenantId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
      },
    });

    if (existing) {
      if (
        ['pending', 'escalated'].includes(existing.status) &&
        this.severityRank(dto.severity) > this.severityRank(existing.severity)
      ) {
        existing.severity = dto.severity;
        existing.summary = dto.summary ?? existing.summary;
        await this.alertRepo.save(existing);
      }
      return existing;
    }

    const slaMin = dto.slaMinutes ?? DEFAULT_SLA[dto.severity] ?? 240;
    const flaggedAt = new Date();
    const slaDeadline = new Date(flaggedAt.getTime() + slaMin * 60_000);

    const alert = this.alertRepo.create({
      ...(tenantId ? { tenantId } : {}),
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      orderId: dto.orderId ?? null,
      patientId: dto.patientId,
      encounterId: dto.encounterId ?? null,
      severity: dto.severity,
      summary: dto.summary ?? null,
      flaggedAt,
      flaggedById: dto.flaggedById ?? null,
      assignedToId: dto.assignedToId ?? null,
      status: 'pending',
      slaDeadline,
      escalationLevel: 0,
    });
    const saved = await this.alertRepo.save(alert);

    void this.auditLog
      .log({
        userId: dto.flaggedById ?? undefined,
        tenantId: tenantId ?? undefined,
        action: 'CRITICAL_RESULT_FLAGGED',
        entityType: 'critical_result_alerts',
        entityId: saved.id,
        newValue: {
          patientId: saved.patientId,
          encounterId: saved.encounterId,
          resourceType: saved.resourceType,
          resourceId: saved.resourceId,
          severity: saved.severity,
          summary: saved.summary,
          assignedToId: saved.assignedToId,
          slaDeadline: saved.slaDeadline,
        },
      })
      .catch((e) => this.logger.warn(`Audit (flag) failed: ${e?.message}`));

    if (saved.assignedToId) {
      try {
        await this.notifications.create(
          {
            targetUserId: saved.assignedToId,
            type: this.notifTypeFor(saved.resourceType),
            title: this.titleFor(saved),
            message: saved.summary || 'Critical result requires acknowledgement.',
            metadata: {
              critical: true,
              alertId: saved.id,
              resourceType: saved.resourceType,
              resourceId: saved.resourceId,
              patientId: saved.patientId,
              severity: saved.severity,
              slaDeadline: saved.slaDeadline,
            },
          },
          tenantId,
        );
        saved.lastNotifiedAt = new Date();
        await this.alertRepo.save(saved);
      } catch (e: any) {
        this.logger.warn(`Critical-result notify failed: ${e?.message}`);
      }
    }

    return saved;
  }

  async list(opts: {
    tenantId?: string;
    status?: string;
    assignedToId?: string;
    patientId?: string;
    flaggedById?: string;
    resourceType?: 'lab' | 'radiology';
    limit?: number;
  }) {
    const where: any = {};
    if (opts.tenantId) where.tenantId = opts.tenantId;
    if (opts.status) where.status = opts.status;
    if (opts.assignedToId) where.assignedToId = opts.assignedToId;
    if (opts.patientId) where.patientId = opts.patientId;
    if (opts.flaggedById) where.flaggedById = opts.flaggedById;
    if (opts.resourceType) where.resourceType = opts.resourceType;

    return this.alertRepo.find({
      where,
      order: { slaDeadline: 'ASC', flaggedAt: 'DESC' },
      take: Math.min(opts.limit ?? 50, 200),
      relations: ['patient', 'assignedTo', 'flaggedBy', 'acknowledgedBy', 'escalatedTo'],
    });
  }

  async countPending(tenantId?: string, assignedToId?: string): Promise<number> {
    const where: any = { status: 'pending' };
    if (tenantId) where.tenantId = tenantId;
    if (assignedToId) where.assignedToId = assignedToId;
    return this.alertRepo.count({ where });
  }

  async getById(id: string, tenantId?: string): Promise<CriticalResultAlert> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const alert = await this.alertRepo.findOne({
      where,
      relations: ['patient', 'assignedTo', 'flaggedBy', 'acknowledgedBy', 'escalatedTo'],
    });
    if (!alert) throw new NotFoundException('Critical result alert not found');
    return alert;
  }

  async stats(opts: {
    tenantId?: string;
    flaggedById?: string;
    resourceType?: 'lab' | 'radiology';
    sinceDays?: number;
  }) {
    const qb = this.alertRepo.createQueryBuilder('a');
    if (opts.tenantId) qb.andWhere('a.tenant_id = :t', { t: opts.tenantId });
    if (opts.flaggedById) qb.andWhere('a.flagged_by_id = :f', { f: opts.flaggedById });
    if (opts.resourceType) qb.andWhere('a.resource_type = :r', { r: opts.resourceType });
    if (opts.sinceDays && opts.sinceDays > 0) {
      qb.andWhere(`a.flagged_at >= NOW() - INTERVAL '${opts.sinceDays} days'`);
    }
    const all = await qb.clone().getMany();
    const now = Date.now();
    return {
      total: all.length,
      pending: all.filter((a) => a.status === 'pending').length,
      acknowledged: all.filter((a) => a.status === 'acknowledged' || a.status === 'resolved')
        .length,
      escalated: all.filter((a) => a.status === 'escalated').length,
      cancelled: all.filter((a) => a.status === 'cancelled').length,
      slaBreached: all.filter(
        (a) =>
          (a.status === 'pending' || a.status === 'escalated') &&
          a.slaDeadline &&
          new Date(a.slaDeadline).getTime() < now,
      ).length,
      bySeverity: {
        critical_low: all.filter((a) => a.severity === 'critical_low').length,
        critical_high: all.filter((a) => a.severity === 'critical_high').length,
        critical: all.filter((a) => a.severity === 'critical').length,
        abnormal: all.filter((a) => a.severity === 'abnormal').length,
      },
    };
  }

  async acknowledge(
    id: string,
    userId: string,
    dto: AcknowledgeCriticalResultDto,
    tenantId?: string,
  ): Promise<CriticalResultAlert> {
    if (!dto?.note || dto.note.trim().length < 10) {
      throw new BadRequestException(
        'Acknowledgement note is required (at least 10 characters describing review and action).',
      );
    }
    const alert = await this.getById(id, tenantId);
    if (alert.status === 'acknowledged' || alert.status === 'resolved') {
      throw new ConflictException('Alert already acknowledged');
    }
    if (alert.status === 'cancelled') {
      throw new ConflictException('Alert is cancelled');
    }
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedById = userId;
    alert.acknowledgementNote = dto.note.trim();
    alert.actionTaken = dto.actionTaken?.trim() || null;
    alert.followUpOrderId = dto.followUpOrderId || null;
    const saved = await this.alertRepo.save(alert);

    void this.auditLog
      .log({
        userId,
        tenantId: tenantId ?? undefined,
        action: 'CRITICAL_RESULT_ACKNOWLEDGED',
        entityType: 'critical_result_alerts',
        entityId: saved.id,
        oldValue: { status: 'pending', escalationLevel: alert.escalationLevel },
        newValue: {
          patientId: saved.patientId,
          severity: saved.severity,
          note: saved.acknowledgementNote,
          actionTaken: saved.actionTaken,
          followUpOrderId: saved.followUpOrderId,
          slaBreached: alert.slaDeadline.getTime() < saved.acknowledgedAt!.getTime(),
        },
        reason: saved.acknowledgementNote || undefined,
      })
      .catch((e) => this.logger.warn(`Audit (ack) failed: ${e?.message}`));

    return saved;
  }

  async cancel(id: string, tenantId?: string): Promise<CriticalResultAlert> {
    const alert = await this.getById(id, tenantId);
    alert.status = 'cancelled';
    const saved = await this.alertRepo.save(alert);
    void this.auditLog
      .log({
        tenantId: tenantId ?? undefined,
        action: 'CRITICAL_RESULT_CANCELLED',
        entityType: 'critical_result_alerts',
        entityId: saved.id,
        newValue: { patientId: saved.patientId, severity: saved.severity },
      })
      .catch((e) => this.logger.warn(`Audit (cancel) failed: ${e?.message}`));
    return saved;
  }

  /**
   * SLA scan — every minute look for pending alerts past their deadline and
   * escalate. Escalation = notify all users with senior clinical roles.
   * Pushes the SLA forward 30 min so the alert re-fires until acknowledged.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'critical-results-sla-scan' })
  async runSlaScan(): Promise<void> {
    const now = new Date();
    let overdue: CriticalResultAlert[];
    try {
      overdue = await this.alertRepo.find({
        where: { status: 'pending', slaDeadline: LessThan(now) },
        take: 100,
      });
    } catch (e: any) {
      this.logger.debug(`SLA scan skipped: ${e?.message}`);
      return;
    }
    if (overdue.length === 0) return;

    for (const alert of overdue) {
      try {
        await this.escalate(alert);
      } catch (e: any) {
        this.logger.warn(`Failed to escalate alert ${alert.id}: ${e?.message}`);
      }
    }
  }

  private async escalate(alert: CriticalResultAlert): Promise<void> {
    const escalationRoles = ['Senior Doctor', 'Doctor', 'Lab Manager', 'Radiologist'];
    const recipientIds = await this.notifications.getUserIdsByRole(
      escalationRoles,
      undefined,
      alert.tenantId,
    );

    const targets = new Set<string>(recipientIds);
    if (alert.assignedToId) targets.add(alert.assignedToId);

    if (targets.size > 0) {
      await this.notifications.notifyMany(
        [...targets],
        {
          type: this.notifTypeFor(alert.resourceType),
          title: `🚨 ESCALATED: Unacknowledged ${alert.resourceType.toUpperCase()} critical result`,
          message: alert.summary || 'Patient-safety SLA breach — review immediately.',
          metadata: {
            critical: true,
            escalated: true,
            alertId: alert.id,
            resourceType: alert.resourceType,
            resourceId: alert.resourceId,
            patientId: alert.patientId,
            severity: alert.severity,
            escalationLevel: alert.escalationLevel + 1,
          },
        },
        alert.tenantId,
      );
    }

    alert.escalationLevel = Math.min(alert.escalationLevel + 1, 3);
    alert.escalatedAt = new Date();
    alert.lastNotifiedAt = new Date();
    alert.slaDeadline = new Date(Date.now() + 30 * 60_000);
    // Keep status='pending' so it remains in worklists; escalation_level + escalated_at are audit markers.
    alert.status = 'pending';
    const saved = await this.alertRepo.save(alert);

    void this.auditLog
      .log({
        tenantId: alert.tenantId ?? undefined,
        action: 'CRITICAL_RESULT_ESCALATED',
        entityType: 'critical_result_alerts',
        entityId: saved.id,
        newValue: {
          patientId: saved.patientId,
          severity: saved.severity,
          escalationLevel: saved.escalationLevel,
          recipientCount: targets.size,
        },
      })
      .catch((e) => this.logger.warn(`Audit (escalate) failed: ${e?.message}`));
  }

  private severityRank(s: CriticalResultSeverity): number {
    switch (s) {
      case 'abnormal':
        return 1;
      case 'critical_low':
      case 'critical_high':
      case 'critical':
        return 2;
      default:
        return 0;
    }
  }

  private notifTypeFor(rt: CriticalResultResourceType): InAppNotificationType {
    return rt === 'lab'
      ? InAppNotificationType.LAB_RESULT_READY
      : InAppNotificationType.RADIOLOGY_RESULT_READY;
  }

  private titleFor(a: CriticalResultAlert): string {
    const label = a.resourceType === 'lab' ? 'Lab' : 'Radiology';
    const sev = a.severity === 'abnormal' ? 'Abnormal' : 'CRITICAL';
    return `🚨 ${sev} ${label} Result — review required`;
  }
}
