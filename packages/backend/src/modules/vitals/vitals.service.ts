import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Vital, VitalSource, ConsciousnessLevel, ClinicalRiskLevel } from '../../database/entities/vital.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateVitalDto, UpdateVitalDto } from './vitals.dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface EarlyWarningScores {
  newsScore: number;
  mewsScore: number;
  newsComponents: Record<string, number>;
  clinicalRiskLevel: ClinicalRiskLevel;
}

export interface VitalAlert {
  parameter: string;
  value: number;
  severity: 'warning' | 'critical';
  message: string;
}

// Clinical vital sign thresholds (adult defaults)
const VITAL_THRESHOLDS = {
  temperature: { criticalLow: 34, warningLow: 35.5, warningHigh: 38.5, criticalHigh: 40 },
  pulse: { criticalLow: 40, warningLow: 50, warningHigh: 100, criticalHigh: 140 },
  bpSystolic: { criticalLow: 80, warningLow: 90, warningHigh: 140, criticalHigh: 180 },
  bpDiastolic: { criticalLow: 50, warningLow: 60, warningHigh: 90, criticalHigh: 120 },
  respiratoryRate: { criticalLow: 8, warningLow: 12, warningHigh: 20, criticalHigh: 30 },
  oxygenSaturation: { criticalLow: 90, warningLow: 94, warningHigh: 100, criticalHigh: 101 },
  bloodGlucose: { criticalLow: 40, warningLow: 70, warningHigh: 180, criticalHigh: 300 },
} as const;

const PARAMETER_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  pulse: 'Pulse',
  bpSystolic: 'Systolic BP',
  bpDiastolic: 'Diastolic BP',
  respiratoryRate: 'Respiratory Rate',
  oxygenSaturation: 'SpO2',
  bloodGlucose: 'Blood Glucose',
};

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(
    @InjectRepository(Vital)
    private vitalRepository: Repository<Vital>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    private inAppNotifications: InAppNotificationsService,
    private auditLogService: AuditLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  private calculateBMI(weight: number, heightCm: number): number | null {
    if (!weight || !heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weight / (heightM * heightM)) * 10) / 10;
  }

  /**
   * Compute NEWS2 + MEWS early warning scores per Royal College of Physicians.
   * Public so triage can call it without saving a vital record.
   *
   * NEWS2 parameters: RespRate, SpO2, supplementalO2, temperature, systolicBP, HR, consciousness (AVPU)
   * Returns null if insufficient data (need at least RR + SpO2 + HR).
   */
  computeEarlyWarningScores(params: {
    temperature?: number | null;
    pulse?: number | null;
    bpSystolic?: number | null;
    respiratoryRate?: number | null;
    oxygenSaturation?: number | null;
    consciousnessLevel?: ConsciousnessLevel | string | null;
    supplementalOxygen?: boolean | null;
  }): EarlyWarningScores | null {
    const rr = params.respiratoryRate != null ? Number(params.respiratoryRate) : null;
    const spo2 = params.oxygenSaturation != null ? Number(params.oxygenSaturation) : null;
    const hr = params.pulse != null ? Number(params.pulse) : null;

    // Minimum required: RR, SpO2, HR
    if (rr == null || spo2 == null || hr == null) return null;

    const temp = params.temperature != null ? Number(params.temperature) : null;
    const sbp = params.bpSystolic != null ? Number(params.bpSystolic) : null;
    const avpu = params.consciousnessLevel || 'A';
    const onO2 = params.supplementalOxygen ?? false;

    const components: Record<string, number> = {};

    // --- NEWS2 Scoring (Scale 1 — standard SpO2) ---
    // Respiration rate
    if (rr <= 8) components.respiratoryRate = 3;
    else if (rr <= 11) components.respiratoryRate = 1;
    else if (rr <= 20) components.respiratoryRate = 0;
    else if (rr <= 24) components.respiratoryRate = 2;
    else components.respiratoryRate = 3;

    // SpO2 Scale 1 (default)
    if (spo2 <= 91) components.oxygenSaturation = 3;
    else if (spo2 <= 93) components.oxygenSaturation = 2;
    else if (spo2 <= 95) components.oxygenSaturation = 1;
    else components.oxygenSaturation = 0;

    // Air or oxygen
    components.supplementalOxygen = onO2 ? 2 : 0;

    // Temperature
    if (temp != null) {
      if (temp <= 35.0) components.temperature = 3;
      else if (temp <= 36.0) components.temperature = 1;
      else if (temp <= 38.0) components.temperature = 0;
      else if (temp <= 39.0) components.temperature = 1;
      else components.temperature = 2;
    } else {
      components.temperature = 0;
    }

    // Systolic BP
    if (sbp != null) {
      if (sbp <= 90) components.bpSystolic = 3;
      else if (sbp <= 100) components.bpSystolic = 2;
      else if (sbp <= 110) components.bpSystolic = 1;
      else if (sbp <= 219) components.bpSystolic = 0;
      else components.bpSystolic = 3;
    } else {
      components.bpSystolic = 0;
    }

    // Heart rate / pulse
    if (hr <= 40) components.pulse = 3;
    else if (hr <= 50) components.pulse = 1;
    else if (hr <= 90) components.pulse = 0;
    else if (hr <= 110) components.pulse = 1;
    else if (hr <= 130) components.pulse = 2;
    else components.pulse = 3;

    // Consciousness (AVPU)
    components.consciousness = avpu === 'A' ? 0 : 3;

    const newsScore = Object.values(components).reduce((a, b) => a + b, 0);

    // --- MEWS (Modified Early Warning Score) ---
    // Simplified MEWS: SBP, HR, RR, Temp, AVPU
    let mewsScore = 0;
    // SBP
    if (sbp != null) {
      if (sbp <= 70) mewsScore += 3;
      else if (sbp <= 80) mewsScore += 2;
      else if (sbp <= 100) mewsScore += 1;
      else if (sbp <= 199) mewsScore += 0;
      else mewsScore += 2;
    }
    // HR
    if (hr <= 40) mewsScore += 2;
    else if (hr <= 50) mewsScore += 1;
    else if (hr <= 100) mewsScore += 0;
    else if (hr <= 110) mewsScore += 1;
    else if (hr <= 129) mewsScore += 2;
    else mewsScore += 3;
    // RR
    if (rr < 9) mewsScore += 2;
    else if (rr <= 14) mewsScore += 0;
    else if (rr <= 20) mewsScore += 1;
    else if (rr <= 29) mewsScore += 2;
    else mewsScore += 3;
    // Temp
    if (temp != null) {
      if (temp < 35.0) mewsScore += 2;
      else if (temp <= 38.4) mewsScore += 0;
      else mewsScore += 2;
    }
    // AVPU
    if (avpu === 'A') mewsScore += 0;
    else if (avpu === 'V') mewsScore += 1;
    else if (avpu === 'P') mewsScore += 2;
    else mewsScore += 3;

    // Clinical risk level per NEWS2 guidelines
    let clinicalRiskLevel: ClinicalRiskLevel;
    const hasIndividual3 = Object.values(components).some((v) => v === 3);
    if (newsScore >= 7) {
      clinicalRiskLevel = ClinicalRiskLevel.HIGH;
    } else if (newsScore >= 5) {
      clinicalRiskLevel = ClinicalRiskLevel.MEDIUM;
    } else if (hasIndividual3) {
      clinicalRiskLevel = ClinicalRiskLevel.LOW_MEDIUM;
    } else {
      clinicalRiskLevel = ClinicalRiskLevel.LOW;
    }

    return { newsScore, mewsScore, newsComponents: components, clinicalRiskLevel };
  }

  /** Apply early warning scores to a vital record and emit deterioration event if needed. */
  private async applyScoresAndEmit(
    vital: Vital,
    encounter?: { facilityId?: string } | null,
    tenantId?: string,
  ): Promise<void> {
    const scores = this.computeEarlyWarningScores({
      temperature: vital.temperature,
      pulse: vital.pulse,
      bpSystolic: vital.bpSystolic,
      respiratoryRate: vital.respiratoryRate,
      oxygenSaturation: vital.oxygenSaturation,
      consciousnessLevel: vital.consciousnessLevel,
      supplementalOxygen: vital.supplementalOxygen,
    });

    if (!scores) return;

    vital.newsScore = scores.newsScore;
    vital.mewsScore = scores.mewsScore;
    vital.newsComponents = scores.newsComponents;
    vital.clinicalRiskLevel = scores.clinicalRiskLevel;
    await this.vitalRepository.save(vital);

    // Emit deterioration event for NEWS >= 5
    if (scores.newsScore >= 5) {
      this.eventEmitter.emit('vital.deterioration', {
        vitalId: vital.id,
        patientId: vital.patientId,
        encounterId: vital.encounterId,
        newsScore: scores.newsScore,
        clinicalRiskLevel: scores.clinicalRiskLevel,
        tenantId,
        facilityId: encounter?.facilityId,
      });
    }
  }

  /** Get NEWS score trend for a patient over time. */
  async getNewsTrend(
    patientId: string,
    limit = 20,
    tenantId?: string,
  ): Promise<Pick<Vital, 'id' | 'recordedAt' | 'newsScore' | 'mewsScore' | 'clinicalRiskLevel'>[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.vitalRepository
      .createQueryBuilder('v')
      .select(['v.id', 'v.recordedAt', 'v.newsScore', 'v.mewsScore', 'v.clinicalRiskLevel'])
      .where('v.patient_id = :patientId', { patientId })
      .andWhere('v.news_score IS NOT NULL');

    qb.andWhere('v.tenant_id = :tenantId', { tenantId: tid });

    return qb.orderBy('v.recorded_at', 'DESC').take(limit).getMany();
  }

  /** Check vitals against clinical thresholds and return alerts */
  checkVitalAlerts(vital: Partial<Vital>): VitalAlert[] {
    const alerts: VitalAlert[] = [];

    for (const [param, thresholds] of Object.entries(VITAL_THRESHOLDS)) {
      const value = vital[param as keyof Vital] as number | undefined;
      if (value == null) continue;

      const label = PARAMETER_LABELS[param] || param;

      if (value <= thresholds.criticalLow) {
        alerts.push({
          parameter: param,
          value,
          severity: 'critical',
          message: `${label} critically low: ${value}`,
        });
      } else if (value <= thresholds.warningLow) {
        alerts.push({
          parameter: param,
          value,
          severity: 'warning',
          message: `${label} below normal: ${value}`,
        });
      } else if (value >= thresholds.criticalHigh) {
        alerts.push({
          parameter: param,
          value,
          severity: 'critical',
          message: `${label} critically high: ${value}`,
        });
      } else if (value >= thresholds.warningHigh) {
        alerts.push({
          parameter: param,
          value,
          severity: 'warning',
          message: `${label} above normal: ${value}`,
        });
      }
    }

    return alerts;
  }

  async create(
    dto: CreateVitalDto,
    userId: string,
    tenantId?: string,
  ): Promise<Vital & { alerts?: VitalAlert[] }> {
    const tid = requireTenantId(tenantId);
    // Verify encounter exists
    const encounterWhere: any = { id: dto.encounterId, tenantId: tid };
    const encounter = await this.encounterRepository.findOne({
      where: encounterWhere,
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    // Calculate BMI if height and weight provided
    let bmi = dto.bmi;
    if (!bmi && dto.weight && dto.height) {
      bmi = this.calculateBMI(dto.weight, dto.height) ?? undefined;
    }

    const vital = this.vitalRepository.create({
      ...dto,
      bmi,
      patientId: encounter.patientId,
      source: VitalSource.OPD_ENCOUNTER,
      recordedById: userId,
      tenantId: tid,
    });

    const savedVital = await this.vitalRepository.save(vital);

    // Compute early warning scores (NEWS2 + MEWS)
    await this.applyScoresAndEmit(savedVital, encounter, tenantId);

    // Check for abnormal vitals and generate alerts
    const alerts = this.checkVitalAlerts(savedVital);
    if (alerts.length > 0) {
      const criticals = alerts.filter((a) => a.severity === 'critical');
      if (criticals.length > 0) {
        this.logger.warn(
          `CRITICAL VITAL ALERTS for encounter ${dto.encounterId}: ${criticals.map((a) => a.message).join('; ')}`,
        );

        // Fan out an in-app notification to the attending doctor (if any) and
        // any nurse watching this facility's nursing channel. Failures are
        // logged but never block the save — clinicians need the vital saved
        // even if the WebSocket gateway is down.
        try {
          const summary = criticals.map((a) => a.message).join('; ');
          const targets: string[] = [];
          if (encounter.attendingProviderId) {
            targets.push(encounter.attendingProviderId);
          }
          // Charge nurses on this facility (best-effort role lookup)
          const nurseIds = await this.inAppNotifications
            .getUserIdsByRole(
              ['charge_nurse', 'nurse_supervisor', 'nurse'],
              encounter.facilityId,
              tenantId,
            )
            .catch(() => [] as string[]);
          targets.push(...nurseIds);
          const unique = [...new Set(targets)].filter(Boolean);
          if (unique.length > 0) {
            await this.inAppNotifications.notifyMany(
              unique,
              {
                facilityId: encounter.facilityId,
                senderUserId: userId,
                type: InAppNotificationType.GENERAL,
                title: 'Critical vital sign',
                message: summary,
                metadata: {
                  kind: 'critical_vital',
                  encounterId: encounter.id,
                  patientId: encounter.patientId,
                  vitalId: savedVital.id,
                  alerts: criticals,
                },
              },
              tenantId,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to fan out critical vital alert for encounter ${dto.encounterId}: ${err?.message || err}`,
          );
        }

        // Audit log: critical vitals are a regulated clinical event
        await this.auditLogService
          .log({
            userId,
            action: 'VITAL_CRITICAL_RECORDED',
            entityType: 'Vital',
            entityId: savedVital.id,
            newValue: {
              alerts: criticals,
              encounterId: encounter.id,
              patientId: encounter.patientId,
            },
            tenantId: tid,
          })
          .catch((err) =>
            this.logger.error(
              `Audit log failed for critical vital ${savedVital.id}: ${err.message}`,
            ),
          );
      }
    }

    // Update encounter status to WAITING if it was REGISTERED
    if (encounter.status === EncounterStatus.REGISTERED) {
      encounter.status = EncounterStatus.WAITING;
      await this.encounterRepository.save(encounter);
    }

    return { ...savedVital, alerts: alerts.length > 0 ? alerts : undefined };
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<Vital[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { encounterId, deletedAt: IsNull(), tenantId: tid };
    return this.vitalRepository.find({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findLatestByEncounter(encounterId: string, tenantId?: string): Promise<Vital | null> {
    const tid = requireTenantId(tenantId);
    const where: any = { encounterId, deletedAt: IsNull(), tenantId: tid };
    return this.vitalRepository.findOne({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findOne(id: string, tenantId?: string): Promise<Vital> {
    const tid = requireTenantId(tenantId);
    const where: any = { id, tenantId: tid };
    const vital = await this.vitalRepository.findOne({
      where,
      relations: ['encounter', 'recordedBy'],
    });

    if (!vital) {
      throw new NotFoundException('Vital record not found');
    }

    return vital;
  }

  async update(id: string, dto: UpdateVitalDto, tenantId?: string): Promise<Vital> {
    const vital = await this.findOne(id, tenantId);

    // Recalculate BMI if height or weight changed
    const weight = dto.weight ?? vital.weight;
    const height = dto.height ?? vital.height;
    const bmi = this.calculateBMI(weight, height);

    Object.assign(vital, dto, { bmi });
    return this.vitalRepository.save(vital);
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    const vital = await this.findOne(id, tenantId);
    await this.vitalRepository.softRemove(vital);
  }

  // Get patient's vital history across encounters
  async getPatientVitalHistory(patientId: string, limit = 10, tenantId?: string): Promise<Vital[]> {
    const tid = requireTenantId(tenantId);
    // Prefer the denormalized patient_id column (covers mirrored rows that
    // have no encounter), but also include legacy rows where it was null
    // by joining through the encounter.
    const qb = this.vitalRepository
      .createQueryBuilder('vital')
      .leftJoinAndSelect('vital.encounter', 'encounter')
      .leftJoinAndSelect('vital.recordedBy', 'recordedBy')
      .where('(vital.patient_id = :patientId OR encounter.patient_id = :patientId)', { patientId });

    qb.andWhere('vital.tenant_id = :tenantId', { tenantId: tid });

    return qb.orderBy('vital.recordedAt', 'DESC').take(limit).getMany();
  }

  /**
   * Mirror vitals captured by another module (emergency triage, IPD nursing
   * round, discharge summary, maternity visit) into the canonical `vitals`
   * table so the patient timeline + critical-vital alerting see them too.
   *
   * Best-effort: failures are logged but never thrown, because the source
   * record's transaction has already committed and we must not roll it back.
   */
  async recordFromSource(params: {
    source: VitalSource;
    sourceRefId: string;
    patientId: string;
    encounterId?: string | null;
    recordedById: string;
    tenantId?: string;
    facilityId?: string;
    recordedAt?: Date;
    consciousnessLevel?: ConsciousnessLevel | string | null;
    supplementalOxygen?: boolean | null;
    vitals?: Partial<
      Pick<
        Vital,
        | 'temperature'
        | 'pulse'
        | 'bpSystolic'
        | 'bpDiastolic'
        | 'respiratoryRate'
        | 'oxygenSaturation'
        | 'weight'
        | 'height'
        | 'bmi'
        | 'bloodGlucose'
        | 'painScale'
        | 'notes'
      >
    >;
    // Flat params (alternative to vitals object, used by triage)
    temperature?: number | null;
    pulse?: number | null;
    bpSystolic?: number | null;
    bpDiastolic?: number | null;
    respiratoryRate?: number | null;
    oxygenSaturation?: number | null;
    bloodGlucose?: number | null;
    weight?: number | null;
  }): Promise<Vital | null> {
    const tid = requireTenantId(params.tenantId);
    try {
      // Merge flat params with vitals object (flat params take precedence for triage callers)
      const v = {
        ...(params.vitals || {}),
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        ...(params.pulse != null ? { pulse: params.pulse } : {}),
        ...(params.bpSystolic != null ? { bpSystolic: params.bpSystolic } : {}),
        ...(params.bpDiastolic != null ? { bpDiastolic: params.bpDiastolic } : {}),
        ...(params.respiratoryRate != null ? { respiratoryRate: params.respiratoryRate } : {}),
        ...(params.oxygenSaturation != null ? { oxygenSaturation: params.oxygenSaturation } : {}),
        ...(params.bloodGlucose != null ? { bloodGlucose: params.bloodGlucose } : {}),
        ...(params.weight != null ? { weight: params.weight } : {}),
      };
      // Skip if every clinically-meaningful field is null/undefined.
      const meaningful = [
        v.temperature,
        v.pulse,
        v.bpSystolic,
        v.bpDiastolic,
        v.respiratoryRate,
        v.oxygenSaturation,
        v.weight,
        v.height,
        v.bloodGlucose,
        v.painScale,
      ].some((x) => x != null);
      if (!meaningful) return null;

      const bmi = v.bmi ?? this.calculateBMI(v.weight ?? 0, v.height ?? 0) ?? undefined;

      const vital = this.vitalRepository.create({
        ...v,
        bmi,
        patientId: params.patientId,
        encounterId: params.encounterId ?? null,
        source: params.source,
        sourceRefId: params.sourceRefId,
        recordedById: params.recordedById,
        recordedAt: params.recordedAt ?? new Date(),
        consciousnessLevel: (params.consciousnessLevel as ConsciousnessLevel) || null,
        supplementalOxygen: params.supplementalOxygen ?? false,
        tenantId: tid,
      } as Partial<Vital>);

      const saved = await this.vitalRepository.save(vital);

      // Compute early warning scores on mirrored vitals
      await this.applyScoresAndEmit(saved, { facilityId: params.facilityId }, params.tenantId);

      // Run alerting + audit on mirrored rows too — a critical SpO2 captured
      // at triage is just as urgent as one captured in OPD.
      const alerts = this.checkVitalAlerts(saved);
      const criticals = alerts.filter((a) => a.severity === 'critical');
      if (criticals.length > 0) {
        this.logger.warn(
          `CRITICAL VITAL ALERTS [${params.source}] patient ${params.patientId}: ${criticals
            .map((a) => a.message)
            .join('; ')}`,
        );

        try {
          const targets: string[] = [];
          if (params.facilityId) {
            const nurseIds = await this.inAppNotifications
              .getUserIdsByRole(
                ['charge_nurse', 'nurse_supervisor', 'nurse'],
                params.facilityId,
                params.tenantId,
              )
              .catch(() => [] as string[]);
            targets.push(...nurseIds);
          }
          const unique = [...new Set(targets)].filter(Boolean);
          if (unique.length > 0) {
            await this.inAppNotifications.notifyMany(
              unique,
              {
                facilityId: params.facilityId!,
                senderUserId: params.recordedById,
                type: InAppNotificationType.GENERAL,
                title: `Critical vital sign (${params.source})`,
                message: criticals.map((a) => a.message).join('; '),
                metadata: {
                  kind: 'critical_vital',
                  source: params.source,
                  sourceRefId: params.sourceRefId,
                  patientId: params.patientId,
                  encounterId: params.encounterId ?? null,
                  vitalId: saved.id,
                  alerts: criticals,
                },
              },
              params.tenantId,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to fan out mirrored critical vital alert (${params.source} ${params.sourceRefId}): ${err?.message || err}`,
          );
        }

        await this.auditLogService
          .log({
            userId: params.recordedById,
            action: 'VITAL_CRITICAL_RECORDED',
            entityType: 'Vital',
            entityId: saved.id,
            newValue: {
              alerts: criticals,
              source: params.source,
              sourceRefId: params.sourceRefId,
              patientId: params.patientId,
              encounterId: params.encounterId ?? null,
            },
            tenantId: tid,
          })
          .catch((err) =>
            this.logger.error(
              `Audit log failed for mirrored critical vital ${saved.id}: ${err.message}`,
            ),
          );
      }

      return saved;
    } catch (err: any) {
      this.logger.error(
        `recordFromSource(${params.source}) failed for ref ${params.sourceRefId}: ${err?.message || err}`,
      );
      return null;
    }
  }
}
