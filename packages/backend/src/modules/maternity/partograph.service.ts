import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  PartographObservation,
  LiquorState,
  MouldingGrade,
} from '../../database/entities/partograph-observation.entity';
import { LabourRecord, LabourStatus } from '../../database/entities/labour-record.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface RecordPartographObservationDto {
  observedAt?: string;
  cervicalDilationCm?: number;
  descentFifths?: number;
  contractionsPer10Min?: number;
  contractionDurationSeconds?: number;
  fetalHeartRate?: number;
  liquor?: LiquorState;
  moulding?: MouldingGrade;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  temperature?: number;
  urineOutput?: string;
  urineProtein?: string;
  urineAcetone?: string;
  oxytocinUnitsPerLitre?: number;
  oxytocinDropsPerMin?: number;
  notes?: string;
}

export type PartographProgressStatus =
  | 'latent_phase'
  | 'normal'
  | 'alert_line_crossed'
  | 'action_line_crossed';

const ACTIVE_PHASE_DILATION_CM = 4; // WHO: active phase from 4 cm
const ALERT_LINE_CM_PER_HOUR = 1; // WHO alert line slope
const ACTION_LINE_OFFSET_HOURS = 4; // action line = alert line + 4 h
const FHR_LOW = 110;
const FHR_HIGH = 160;

const ACTIVE_LABOUR_STATUSES: LabourStatus[] = [
  LabourStatus.ADMITTED,
  LabourStatus.FIRST_STAGE,
  LabourStatus.SECOND_STAGE,
  LabourStatus.THIRD_STAGE,
];

@Injectable()
export class PartographService {
  private readonly logger = new Logger(PartographService.name);

  constructor(
    @InjectRepository(PartographObservation)
    private readonly obsRepo: Repository<PartographObservation>,
    @InjectRepository(LabourRecord)
    private readonly labourRepo: Repository<LabourRecord>,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => InAppNotificationsService))
    private readonly inAppNotifications: InAppNotificationsService | null,
  ) {}

  // ─── Recording ──────────────────────────────────────────────────────────────

  async recordObservation(
    labourRecordId: string,
    dto: RecordPartographObservationDto,
    userId: string,
    tenantId?: string,
  ): Promise<{
    observation: PartographObservation;
    progressStatus: PartographProgressStatus;
    fhrAbnormal: boolean;
    alerts: string[];
  }> {
    const tid = requireTenantId(tenantId);
    this.validateRanges(dto);

    const observedAt = dto.observedAt ? new Date(dto.observedAt) : new Date();
    if (Number.isNaN(observedAt.getTime())) {
      throw new BadRequestException('Invalid observedAt timestamp');
    }
    if (observedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('observedAt cannot be in the future');
    }

    const { observation, labour, priorObservations } = await this.dataSource.transaction(
      async (manager) => {
        const labour = await manager.findOne(LabourRecord, {
          where: { id: labourRecordId, tenantId: tid },
          lock: { mode: 'pessimistic_write' },
        });
        if (!labour) throw new NotFoundException('Labour record not found');
        if (!ACTIVE_LABOUR_STATUSES.includes(labour.status)) {
          throw new BadRequestException(
            `Cannot chart partograph observations on a '${labour.status}' labour`,
          );
        }

        const priorObservations = await manager.find(PartographObservation, {
          where: { labourRecordId, tenantId: tid },
          order: { observedAt: 'ASC' },
        });

        const observation = await manager.save(
          manager.create(PartographObservation, {
            labourRecordId,
            facilityId: labour.facilityId,
            observedAt,
            cervicalDilationCm: dto.cervicalDilationCm ?? null,
            descentFifths: dto.descentFifths ?? null,
            contractionsPer10Min: dto.contractionsPer10Min ?? null,
            contractionDurationSeconds: dto.contractionDurationSeconds ?? null,
            fetalHeartRate: dto.fetalHeartRate ?? null,
            liquor: dto.liquor ?? null,
            moulding: dto.moulding ?? null,
            pulse: dto.pulse ?? null,
            bpSystolic: dto.bpSystolic ?? null,
            bpDiastolic: dto.bpDiastolic ?? null,
            temperature: dto.temperature ?? null,
            urineOutput: dto.urineOutput ?? null,
            urineProtein: dto.urineProtein ?? null,
            urineAcetone: dto.urineAcetone ?? null,
            oxytocinUnitsPerLitre: dto.oxytocinUnitsPerLitre ?? null,
            oxytocinDropsPerMin: dto.oxytocinDropsPerMin ?? null,
            notes: dto.notes ?? null,
            recordedById: userId,
            tenantId: tid,
          }),
        );

        // Keep the labour record's headline progress in sync (same stage
        // rules as updateLabourProgress)
        if (dto.cervicalDilationCm != null) {
          labour.cervicalDilation = dto.cervicalDilationCm;
          if (dto.cervicalDilationCm < 10) {
            labour.status =
              labour.status === LabourStatus.ADMITTED ? LabourStatus.FIRST_STAGE : labour.status;
          } else {
            labour.status = LabourStatus.SECOND_STAGE;
          }
          await manager.save(labour);
        }

        return { observation, labour, priorObservations };
      },
    );

    // ── Breach analysis (previous vs current so alerts fire once per breach) ──
    const allObs = [...priorObservations, observation];
    const previousStatus = this.computeProgressStatus(priorObservations);
    const progressStatus = this.computeProgressStatus(allObs);

    const fhrAbnormal =
      dto.fetalHeartRate != null && (dto.fetalHeartRate < FHR_LOW || dto.fetalHeartRate > FHR_HIGH);

    const alerts: string[] = [];
    if (fhrAbnormal) {
      alerts.push(
        `Abnormal fetal heart rate ${dto.fetalHeartRate} bpm (normal ${FHR_LOW}–${FHR_HIGH})`,
      );
    }
    if (progressStatus === 'alert_line_crossed' && previousStatus !== 'alert_line_crossed') {
      alerts.push('Labour progress has crossed the WHO ALERT line (slower than 1 cm/hour)');
    }
    if (progressStatus === 'action_line_crossed' && previousStatus !== 'action_line_crossed') {
      alerts.push(
        'Labour progress has crossed the WHO ACTION line — senior review / intervention required',
      );
    }

    if (alerts.length > 0) {
      await this.notifyLabourTeam(labour, alerts, tid);
    }

    return { observation, progressStatus, fhrAbnormal, alerts };
  }

  // ─── Reading ────────────────────────────────────────────────────────────────

  async getPartograph(labourRecordId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const labour = await this.labourRepo.findOne({
      where: { id: labourRecordId, tenantId: tid },
      relations: ['registration', 'registration.patient'],
    });
    if (!labour) throw new NotFoundException('Labour record not found');

    const observations = await this.obsRepo.find({
      where: { labourRecordId, tenantId: tid },
      order: { observedAt: 'ASC' },
    });

    const activePhase = this.findActivePhaseStart(observations);
    const progressStatus = this.computeProgressStatus(observations);
    const latestFhr = [...observations].reverse().find((o) => o.fetalHeartRate != null);

    return {
      labour: {
        id: labour.id,
        labourNumber: labour.labourNumber,
        status: labour.status,
        admissionTime: labour.admissionTime,
        patient: labour.registration?.patient
          ? {
              id: labour.registration.patient.id,
              name: labour.registration.patient.fullName,
              mrn: labour.registration.patient.mrn,
            }
          : null,
      },
      observations,
      analysis: {
        progressStatus,
        activePhaseStartAt: activePhase?.startAt ?? null,
        activePhaseStartDilationCm: activePhase?.startDilation ?? null,
        // Line parameters for the frontend chart: dilation(t) = start + slope·hours
        alertLine: activePhase
          ? {
              startAt: activePhase.startAt,
              startDilationCm: activePhase.startDilation,
              cmPerHour: ALERT_LINE_CM_PER_HOUR,
            }
          : null,
        actionLine: activePhase
          ? {
              startAt: new Date(
                activePhase.startAt.getTime() + ACTION_LINE_OFFSET_HOURS * 3600 * 1000,
              ),
              startDilationCm: activePhase.startDilation,
              cmPerHour: ALERT_LINE_CM_PER_HOUR,
            }
          : null,
        latestFetalHeartRate: latestFhr?.fetalHeartRate ?? null,
        fetalHeartRateAbnormal:
          latestFhr?.fetalHeartRate != null &&
          (latestFhr.fetalHeartRate < FHR_LOW || latestFhr.fetalHeartRate > FHR_HIGH),
      },
    };
  }

  // ─── WHO line math ──────────────────────────────────────────────────────────

  /** First observation at ≥4 cm marks the start of the charted active phase. */
  private findActivePhaseStart(
    observations: PartographObservation[],
  ): { startAt: Date; startDilation: number } | null {
    for (const o of observations) {
      if (o.cervicalDilationCm != null && o.cervicalDilationCm >= ACTIVE_PHASE_DILATION_CM) {
        return { startAt: new Date(o.observedAt), startDilation: Number(o.cervicalDilationCm) };
      }
    }
    return null;
  }

  /**
   * WHO progress status from the observation series.
   *  - alert line:  expected = startDilation + hoursSinceActiveStart × 1 cm/h
   *  - action line: the alert line displaced 4 hours to the right
   * Evaluated at the latest dilation reading in the active phase.
   */
  private computeProgressStatus(
    observations: PartographObservation[],
  ): PartographProgressStatus {
    const active = this.findActivePhaseStart(observations);
    if (!active) return 'latent_phase';

    const dilations = observations.filter(
      (o) => o.cervicalDilationCm != null && new Date(o.observedAt) >= active.startAt,
    );
    const latest = dilations[dilations.length - 1];
    if (!latest) return 'normal';

    const dilation = Number(latest.cervicalDilationCm);
    if (dilation >= 10) return 'normal'; // fully dilated — lines no longer apply

    const hours =
      (new Date(latest.observedAt).getTime() - active.startAt.getTime()) / 3_600_000;
    const alertExpected = Math.min(10, active.startDilation + hours * ALERT_LINE_CM_PER_HOUR);
    const actionExpected = Math.min(
      10,
      active.startDilation + Math.max(0, hours - ACTION_LINE_OFFSET_HOURS) * ALERT_LINE_CM_PER_HOUR,
    );

    if (dilation < actionExpected) return 'action_line_crossed';
    if (dilation < alertExpected) return 'alert_line_crossed';
    return 'normal';
  }

  // ─── Alerts & validation ────────────────────────────────────────────────────

  private async notifyLabourTeam(
    labour: LabourRecord,
    alerts: string[],
    tenantId: string,
  ): Promise<void> {
    if (!this.inAppNotifications) return;
    try {
      const targets = await this.inAppNotifications.getUserIdsByRole(
        ['midwife', 'charge_nurse', 'nurse_supervisor', 'doctor', 'obstetrician'],
        labour.facilityId,
        tenantId,
      );
      if (targets.length === 0) return;
      await this.inAppNotifications.notifyMany(
        targets,
        {
          type: InAppNotificationType.GENERAL,
          title: 'Partograph Alert',
          message: `Labour ${labour.labourNumber}: ${alerts.join('; ')}`,
          facilityId: labour.facilityId,
          metadata: { kind: 'partograph_alert', labourRecordId: labour.id, alerts },
        },
        tenantId,
      );
    } catch (err: any) {
      this.logger.warn(`Partograph alert notification failed: ${err.message}`);
    }
  }

  private validateRanges(dto: RecordPartographObservationDto): void {
    const problems: string[] = [];
    const inRange = (v: number | undefined, lo: number, hi: number, label: string) => {
      if (v != null && (v < lo || v > hi)) problems.push(`${label} must be between ${lo} and ${hi}`);
    };
    inRange(dto.cervicalDilationCm, 0, 10, 'cervicalDilationCm');
    inRange(dto.descentFifths, 0, 5, 'descentFifths');
    inRange(dto.contractionsPer10Min, 0, 10, 'contractionsPer10Min');
    inRange(dto.contractionDurationSeconds, 0, 300, 'contractionDurationSeconds');
    inRange(dto.fetalHeartRate, 40, 240, 'fetalHeartRate');
    inRange(dto.pulse, 20, 250, 'pulse');
    inRange(dto.bpSystolic, 40, 300, 'bpSystolic');
    inRange(dto.bpDiastolic, 20, 200, 'bpDiastolic');
    inRange(dto.temperature, 30, 45, 'temperature');
    if (problems.length > 0) {
      throw new BadRequestException(`Invalid partograph values: ${problems.join('; ')}`);
    }
    const hasAnyValue = [
      dto.cervicalDilationCm,
      dto.descentFifths,
      dto.contractionsPer10Min,
      dto.fetalHeartRate,
      dto.pulse,
      dto.bpSystolic,
      dto.temperature,
      dto.liquor,
      dto.moulding,
    ].some((v) => v != null);
    if (!hasAnyValue) {
      throw new BadRequestException('An observation must contain at least one measurement');
    }
  }
}
