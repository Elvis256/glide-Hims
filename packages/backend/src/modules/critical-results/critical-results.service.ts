import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CriticalResultAlert,
  CriticalResultResourceType,
  CriticalResultSeverity,
} from '../../database/entities/critical-result-alert.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

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
  facilityId?: string | null;
  tenantId?: string | null;
  /**
   * SLA window in minutes from flagged_at.
   * Defaults: critical_low/critical_high/critical = 30, abnormal = 240 (4h).
   */
  slaMinutes?: number;
}

/**
 * A class, not an interface. As an interface the ValidationPipe had no metadata
 * to work from and the body went through untouched: `{"note": {"a": 1}}` reached
 * `dto.note.trim()` and came back a 500, and `followUpOrderId` reached Postgres
 * as whatever string was sent. The 10-character floor stays enforced in the
 * service too — it is a clinical rule about what an acknowledgement must say,
 * not a wire-format rule.
 */
export class AcknowledgeCriticalResultDto {
  @IsString()
  @MinLength(10, {
    message:
      'Acknowledgement note is required (at least 10 characters describing review and action).',
  })
  @MaxLength(4000)
  note: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  actionTaken?: string;

  @IsUUID()
  @IsOptional()
  followUpOrderId?: string;
}

/** Cancelling closes an alert with no clinical review, so it must say why. */
export class CancelCriticalResultDto {
  @IsString()
  @MinLength(10, { message: 'A cancellation reason is required (at least 10 characters).' })
  @MaxLength(2000)
  reason: string;
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
    const tenantId = requireTenantId(dto.tenantId ?? undefined);
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
      tenantId,
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

    await this.notifyFlagged(saved, dto.facilityId ?? null, tenantId);

    return saved;
  }

  /**
   * Tell somebody a critical result exists.
   *
   * This used to notify `assignedToId` and nobody else, inside an
   * `if (saved.assignedToId)`. So a potassium of 1.9 mmol/L reached exactly one
   * person — the doctor who ordered the test — and if that doctor was off shift,
   * on leave, or simply not the one covering the ward, the first anyone else
   * heard of it was the SLA breach thirty minutes later. Where no ordering
   * doctor was recorded at all, nothing was sent and the alert sat silent until
   * the same thirty-minute timer. Thirty minutes is a long time in a
   * hypokalaemia; the whole point of a critical-result register is that reaching
   * one person is not the same as telling the hospital.
   *
   * Never throws: an alert that cannot be delivered must not undo the flag.
   */
  private async notifyFlagged(
    alert: CriticalResultAlert,
    facilityId: string | null,
    tenantId: string,
  ): Promise<void> {
    try {
      const targets = new Set<string>();
      if (alert.assignedToId) targets.add(alert.assignedToId);

      // 'abnormal' carries a four-hour SLA and is the routine case — leave it
      // with the ordering clinician. A true critical has to reach a room.
      if (alert.severity !== 'abnormal') {
        const backup = await this.notifications
          .getUserIdsByRole(this.escalationRolesFor(alert.resourceType), facilityId ?? undefined, tenantId)
          .catch(() => [] as string[]);
        backup.forEach((id) => targets.add(id));
      }

      const recipients = [...targets].filter(Boolean);
      if (recipients.length === 0) {
        this.logger.warn(
          `Critical result ${alert.id} (${alert.severity}) flagged but no recipient could be resolved`,
        );
        return;
      }

      await this.notifications.notifyMany(
        recipients,
        {
          type: this.notifTypeFor(alert.resourceType),
          title: this.titleFor(alert),
          message: alert.summary || 'Critical result requires acknowledgement.',
          facilityId: facilityId ?? undefined,
          metadata: {
            critical: true,
            alertId: alert.id,
            resourceType: alert.resourceType,
            resourceId: alert.resourceId,
            patientId: alert.patientId,
            severity: alert.severity,
            slaDeadline: alert.slaDeadline,
          },
        },
        tenantId,
      );
      alert.lastNotifiedAt = new Date();
      await this.alertRepo.save(alert);
    } catch (e: any) {
      this.logger.warn(`Critical-result notify failed: ${e?.message}`);
    }
  }

  /**
   * Roles worth waking, by what was reported.
   *
   * The old list was `['Senior Doctor', 'Doctor', 'Lab Manager', 'Radiologist']`.
   * Matching is case-insensitive, so 'Doctor' and 'Radiologist' resolved — but
   * **'Senior Doctor' and 'Lab Manager' are not roles this system has**, so two
   * of the four names had never matched a single user. The lab's own seniors,
   * who are called 'Senior Lab Officer' here, were never told about an
   * unacknowledged critical lab result at all.
   */
  private escalationRolesFor(resourceType: CriticalResultResourceType): string[] {
    const clinicians = ['Doctor', 'Medical Officer', 'Department Head'];
    return resourceType === 'lab'
      ? [...clinicians, 'Senior Lab Officer']
      : [...clinicians, 'Radiologist'];
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
    const tid = requireTenantId(opts.tenantId);
    const where: any = {};
    where.tenantId = tid;
    // escalate() deliberately leaves status='pending' so the alert stays in the
    // worklists, which means 'escalated' is a level, not a status, and no row
    // has ever had status='escalated'. Asking for one returned an empty list
    // rather than the escalated alerts — the worklist's Escalated filter was a
    // permanently empty screen. Translate it to what is actually stored.
    if (opts.status === 'escalated') {
      where.status = 'pending';
      where.escalationLevel = MoreThan(0);
    } else if (opts.status) {
      where.status = opts.status;
    }
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
    const tid = requireTenantId(tenantId);
    const where: any = { status: 'pending' };
    where.tenantId = tid;
    if (assignedToId) where.assignedToId = assignedToId;
    return this.alertRepo.count({ where });
  }

  async getById(id: string, tenantId?: string): Promise<CriticalResultAlert> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
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
    const tid = requireTenantId(opts.tenantId);
    const qb = this.alertRepo.createQueryBuilder('a');
    qb.andWhere('a.tenant_id = :t', { t: tid });
    if (opts.flaggedById) qb.andWhere('a.flagged_by_id = :f', { f: opts.flaggedById });
    if (opts.resourceType) qb.andWhere('a.resource_type = :r', { r: opts.resourceType });
    if (opts.sinceDays && Number.isFinite(opts.sinceDays) && opts.sinceDays > 0) {
      // Parameterised, not interpolated. The controller happens to parseInt this
      // before it arrives, which is the only reason a string could not be spliced
      // into the SQL — one refactor away from being a real hole.
      qb.andWhere(`a.flagged_at >= NOW() - (:sinceDays * INTERVAL '1 day')`, {
        sinceDays: Math.floor(opts.sinceDays),
      });
    }
    const all = await qb.clone().getMany();
    const now = Date.now();
    return {
      total: all.length,
      pending: all.filter((a) => a.status === 'pending').length,
      acknowledged: all.filter((a) => a.status === 'acknowledged' || a.status === 'resolved')
        .length,
      // Same reason as list(): a row is escalated when its level is above zero,
      // never by its status. This tile read 0 for every hospital, always.
      escalated: all.filter((a) => a.status === 'pending' && a.escalationLevel > 0).length,
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

  /**
   * Stand down an alert without anybody acknowledging the patient was reviewed —
   * the "the result was amended away" path. Of the three dispositions this was
   * the only one that recorded nobody: no user on the row, and an audit entry
   * whose user_id came through empty, because the userId was never passed in.
   */
  async cancel(
    id: string,
    userId: string,
    dto: CancelCriticalResultDto,
    tenantId?: string,
  ): Promise<CriticalResultAlert> {
    const alert = await this.getById(id, tenantId);
    if (alert.status === 'cancelled') {
      throw new ConflictException('Alert is already cancelled');
    }
    if (alert.status === 'acknowledged' || alert.status === 'resolved') {
      throw new ConflictException('Alert has been acknowledged and cannot be cancelled');
    }
    const previousStatus = alert.status;
    alert.status = 'cancelled';
    alert.cancelledById = userId;
    alert.cancelledAt = new Date();
    alert.cancellationReason = dto.reason.trim();
    const saved = await this.alertRepo.save(alert);
    void this.auditLog
      .log({
        userId,
        tenantId: tenantId ?? undefined,
        action: 'CRITICAL_RESULT_CANCELLED',
        entityType: 'critical_result_alerts',
        entityId: saved.id,
        oldValue: { status: previousStatus, escalationLevel: saved.escalationLevel },
        newValue: {
          patientId: saved.patientId,
          severity: saved.severity,
          cancellationReason: saved.cancellationReason,
        },
        reason: saved.cancellationReason ?? undefined,
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

  /**
   * How long to wait before shouting again, by escalation level.
   *
   * It used to be a flat 30 minutes with no ceiling: status stayed 'pending' so
   * the row was rescanned every minute, `escalationLevel` was capped at 3 but
   * nothing ever read the cap, and the alert re-notified every senior clinician
   * every half hour for as long as it went unacknowledged. Two lab results
   * flagged on 20 August had produced **436 notifications** by the 24th and were
   * still going — 436 of the ~480 notifications in the entire system, from two
   * alerts. An inbox like that is not an alert channel any more, and the next
   * real critical result arrives into a screen everybody has learned to ignore.
   *
   * So: escalate promptly, then back off. It never stops entirely — an
   * unacknowledged critical result is not allowed to go quiet — but after the
   * cap it repeats four-hourly, roughly once a shift, instead of 48 times a day.
   */
  private static readonly ESCALATION_BACKOFF_MINUTES = [30, 60, 120, 240];

  private async escalate(alert: CriticalResultAlert): Promise<void> {
    const recipientIds = await this.notifications
      .getUserIdsByRole(
        this.escalationRolesFor(alert.resourceType),
        undefined,
        alert.tenantId,
      )
      .catch(() => [] as string[]);

    const targets = new Set<string>(recipientIds);
    if (alert.assignedToId) targets.add(alert.assignedToId);

    if (targets.size === 0) {
      this.logger.warn(
        `Critical result ${alert.id} breached its SLA but no recipient could be resolved`,
      );
    }

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
    // escalatedToId was declared on the entity, exposed as an `escalatedTo`
    // relation on every read, and written by nothing — so the column the
    // worklist shows "escalated to" from was always null. Record the ordering
    // clinician when there is one, otherwise the first senior who was told.
    alert.escalatedToId = alert.assignedToId ?? [...targets][0] ?? null;
    const backoff =
      CriticalResultsService.ESCALATION_BACKOFF_MINUTES[
        Math.min(alert.escalationLevel, CriticalResultsService.ESCALATION_BACKOFF_MINUTES.length - 1)
      ];
    alert.slaDeadline = new Date(Date.now() + backoff * 60_000);
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
