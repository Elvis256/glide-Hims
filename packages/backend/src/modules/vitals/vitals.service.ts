import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateVitalDto, UpdateVitalDto } from './vitals.dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

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
  ) {}

  private calculateBMI(weight: number, heightCm: number): number | null {
    if (!weight || !heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weight / (heightM * heightM)) * 10) / 10;
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
    // Verify encounter exists
    const encounterWhere: any = { id: dto.encounterId };
    if (tenantId) encounterWhere.tenantId = tenantId;
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
      recordedById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedVital = await this.vitalRepository.save(vital);

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
            .getUserIdsByRole(['charge_nurse', 'nurse_supervisor', 'nurse'], encounter.facilityId, tenantId)
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
            newValue: { alerts: criticals, encounterId: encounter.id, patientId: encounter.patientId },
            ...(tenantId ? { tenantId } : {}),
          })
          .catch((err) =>
            this.logger.error(`Audit log failed for critical vital ${savedVital.id}: ${err.message}`),
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
    const where: any = { encounterId, deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalRepository.find({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findLatestByEncounter(encounterId: string, tenantId?: string): Promise<Vital | null> {
    const where: any = { encounterId, deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    return this.vitalRepository.findOne({
      where,
      order: { recordedAt: 'DESC' },
      relations: ['recordedBy'],
    });
  }

  async findOne(id: string, tenantId?: string): Promise<Vital> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
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
    const qb = this.vitalRepository
      .createQueryBuilder('vital')
      .leftJoinAndSelect('vital.encounter', 'encounter')
      .where('encounter.patient_id = :patientId', { patientId });

    if (tenantId) {
      qb.andWhere('vital.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('vital.recordedAt', 'DESC').take(limit).getMany();
  }
}
