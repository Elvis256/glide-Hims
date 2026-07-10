import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import {
  SampleReferral,
  ReferralStage,
  ReferralPriority,
} from '../../database/entities/sample-referral.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import {
  CreateSampleReferralDto,
  UpdateStageDto,
  RejectReferralDto,
  SampleReferralQueryDto,
  TATStatsQueryDto,
} from './dto/sample-referral.dto';

@Injectable()
export class SampleReferralService {
  private readonly logger = new Logger(SampleReferralService.name);

  constructor(
    @InjectRepository(SampleReferral) private referralRepo: Repository<SampleReferral>,
    @InjectRepository(LabSample) private sampleRepo: Repository<LabSample>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Facility) private facilityRepo: Repository<Facility>,
    private dataSource: DataSource,
    private inAppNotificationsService: InAppNotificationsService,
  ) {}

  private async generateReferralNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const now = new Date();
    const prefix = `SRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    // P0: serialise referral-number generation per (month,tenant). Without
    // the advisory lock, two concurrent create() calls both observe the
    // same count and produce identical SRF-YYYYMM-NNNNN values; the second
    // insert then throws on the entity's `unique` constraint and surfaces
    // as an unhandled 500.
    const lockKey = `sample_referral_num_${prefix}_${tenantId || 'global'}`;
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    const qb = manager
      .getRepository(SampleReferral)
      .createQueryBuilder('ref')
      .where('ref.referralNumber LIKE :prefix', { prefix: `${prefix}%` });
    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });
    const count = await qb.getCount();

    const seq = String(count + 1).padStart(5, '0');
    return `${prefix}-${seq}`;
  }

  async create(
    dto: CreateSampleReferralDto,
    userId: string,
    tenantId?: string,
  ): Promise<SampleReferral> {
    const sample = await this.sampleRepo.findOne({
      where: { id: dto.sampleId, ...(tenantId ? { tenantId } : {}) },
      relations: ['patient'],
    });
    if (!sample) throw new NotFoundException('Lab sample not found');

    const fromFacility = await this.facilityRepo.findOne({ where: { id: dto.fromFacilityId } });
    if (!fromFacility) throw new NotFoundException('Source facility not found');

    const toFacility = await this.facilityRepo.findOne({ where: { id: dto.toFacilityId } });
    if (!toFacility) throw new NotFoundException('Destination facility not found');

    if (dto.fromFacilityId === dto.toFacilityId) {
      throw new BadRequestException('Source and destination facilities must be different');
    }

    // P0: number generation + insert MUST share one transaction so the
    // advisory lock taken inside generateReferralNumber actually serialises
    // the (count → insert) sequence.
    return this.dataSource.transaction(async (manager) => {
      const referralNumber = await this.generateReferralNumber(manager, tenantId);

      const referral = manager.create(SampleReferral, {
        referralNumber,
        sampleId: dto.sampleId,
        patientId: sample.patientId,
        fromFacilityId: dto.fromFacilityId,
        toFacilityId: dto.toFacilityId,
        stage: ReferralStage.COLLECTED,
        testRequested: dto.testRequested,
        clinicalInfo: dto.clinicalInfo,
        priority: dto.priority || ReferralPriority.ROUTINE,
        transportMethod: dto.transportMethod,
        transporterName: dto.transporterName,
        transporterPhone: dto.transporterPhone,
        notes: dto.notes,
        collectedAt: new Date(),
        collectedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      return manager.save(referral);
    });
  }

  async findAll(
    tenantId?: string,
    facilityId?: string,
    query?: SampleReferralQueryDto,
  ): Promise<SampleReferral[]> {
    const qb = this.referralRepo
      .createQueryBuilder('ref')
      .leftJoinAndSelect('ref.sample', 'sample')
      .leftJoinAndSelect('ref.patient', 'patient')
      .leftJoinAndSelect('ref.fromFacility', 'fromFacility')
      .leftJoinAndSelect('ref.toFacility', 'toFacility');

    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });

    if (query?.stage) {
      qb.andWhere('ref.stage = :stage', { stage: query.stage });
    }

    if (query?.priority) {
      qb.andWhere('ref.priority = :priority', { priority: query.priority });
    }

    const effectiveFacilityId = query?.facilityId || facilityId;
    if (effectiveFacilityId && query?.direction === 'incoming') {
      qb.andWhere('ref.toFacilityId = :fid', { fid: effectiveFacilityId });
    } else if (effectiveFacilityId && query?.direction === 'outgoing') {
      qb.andWhere('ref.fromFacilityId = :fid', { fid: effectiveFacilityId });
    } else if (effectiveFacilityId) {
      qb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', {
        fid: effectiveFacilityId,
      });
    }

    if (query?.fromDate && query?.toDate) {
      const f = new Date(query.fromDate).getTime();
      const t = new Date(query.toDate).getTime();
      if (Number.isFinite(f) && Number.isFinite(t) && f > t) {
        throw new BadRequestException('fromDate must be on or before toDate.');
      }
    }
    if (query?.fromDate) {
      qb.andWhere('ref.created_at >= :fromDate', { fromDate: query.fromDate });
    }
    if (query?.toDate) {
      qb.andWhere('ref.created_at <= :toDate', { toDate: query.toDate });
    }

    if (query?.search) {
      qb.andWhere(
        '(ref.referralNumber ILIKE :search OR patient.firstName ILIKE :search OR patient.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Sort STAT first, then URGENT, then ROUTINE; within each priority, oldest first
    qb.addOrderBy(`CASE ref.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END`, 'ASC');
    qb.addOrderBy('ref.created_at', 'ASC');

    return qb.getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<SampleReferral> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const referral = await this.referralRepo.findOne({
      where,
      relations: ['sample', 'patient', 'fromFacility', 'toFacility'],
    });
    if (!referral) throw new NotFoundException('Sample referral not found');
    return referral;
  }

  async updateStage(
    id: string,
    dto: UpdateStageDto,
    userId: string,
    tenantId?: string,
  ): Promise<SampleReferral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.stage === ReferralStage.REJECTED) {
      throw new BadRequestException('Cannot update stage of a rejected referral');
    }
    if (referral.stage === ReferralStage.RESULT_DELIVERED) {
      throw new BadRequestException('Referral is already fully delivered');
    }

    // P1-7: enforce forward-only stage transitions. Without this guard, a
    // user can move a referral from RESULT_READY back to PACKAGED, which
    // clobbers `packagedAt` (the PACKAGED case unconditionally overwrites
    // it) and breaks the TAT calculation. Stages are listed in workflow
    // order in the enum; we compare ordinal positions.
    const stageOrder: ReferralStage[] = [
      ReferralStage.COLLECTED,
      ReferralStage.PACKAGED,
      ReferralStage.IN_TRANSIT,
      ReferralStage.RECEIVED_AT_HUB,
      ReferralStage.PROCESSING,
      ReferralStage.RESULT_READY,
      ReferralStage.RESULT_DELIVERED,
    ];
    const currentIdx = stageOrder.indexOf(referral.stage);
    const targetIdx = stageOrder.indexOf(dto.stage);
    if (
      targetIdx !== -1 &&
      currentIdx !== -1 &&
      targetIdx <= currentIdx &&
      dto.stage !== ReferralStage.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot move referral backward from '${referral.stage}' to '${dto.stage}'`,
      );
    }

    const now = new Date();
    referral.stage = dto.stage;

    switch (dto.stage) {
      case ReferralStage.PACKAGED:
        referral.packagedAt = now;
        break;
      case ReferralStage.IN_TRANSIT:
        referral.shippedAt = now;
        break;
      case ReferralStage.RECEIVED_AT_HUB:
        referral.receivedAtHubAt = now;
        referral.receivedById = userId;
        if (dto.temperatureOnArrival !== undefined) {
          referral.temperatureOnArrival = dto.temperatureOnArrival;
        }
        if (dto.sampleConditionOnArrival) {
          referral.sampleConditionOnArrival = dto.sampleConditionOnArrival;
        }
        break;
      case ReferralStage.PROCESSING:
        referral.processingStartedAt = now;
        break;
      case ReferralStage.RESULT_READY:
        referral.resultReadyAt = now;
        // Notify the originating facility
        try {
          await this.inAppNotificationsService.create(
            {
              targetUserId: referral.collectedById || userId,
              facilityId: referral.fromFacilityId,
              type: InAppNotificationType.LAB_RESULT_READY,
              title: 'Referral Result Ready',
              message: `Result is ready for referral ${referral.referralNumber}. Patient: ${referral.patient?.fullName || ''}`,
              metadata: { referralId: referral.id, referralNumber: referral.referralNumber },
            },
            tenantId,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to send result notification for ${referral.referralNumber}: ${err.message}`,
          );
        }
        break;
      case ReferralStage.RESULT_DELIVERED:
        referral.resultDeliveredAt = now;
        break;
    }

    if (dto.notes) {
      referral.notes = referral.notes
        ? `${referral.notes}\n[${dto.stage}] ${dto.notes}`
        : `[${dto.stage}] ${dto.notes}`;
    }

    return this.referralRepo.save(referral);
  }

  async reject(
    id: string,
    dto: RejectReferralDto,
    userId: string,
    tenantId?: string,
  ): Promise<SampleReferral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.stage === ReferralStage.RESULT_DELIVERED) {
      throw new BadRequestException('Cannot reject a delivered referral');
    }

    referral.stage = ReferralStage.REJECTED;
    referral.rejectedAt = new Date();
    referral.rejectionReason = dto.rejectionReason;

    try {
      await this.inAppNotificationsService.create(
        {
          targetUserId: referral.collectedById || userId,
          facilityId: referral.fromFacilityId,
          type: InAppNotificationType.LAB_RESULT_READY,
          title: 'Sample Referral Rejected',
          message: `Referral ${referral.referralNumber} was rejected: ${dto.rejectionReason}`,
          metadata: { referralId: referral.id, referralNumber: referral.referralNumber },
        },
        tenantId,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send rejection notification for ${referral.referralNumber}: ${err.message}`,
      );
    }

    return this.referralRepo.save(referral);
  }

  async getDashboard(tenantId?: string, facilityId?: string): Promise<Record<string, any>> {
    // P1-8: previous impl loaded every referral row into memory then
    // counted/averaged in JS — unbounded DoS vector on multi-facility
    // deployments. Push counts + TAT aggregation into SQL.
    const stageQb = this.referralRepo
      .createQueryBuilder('ref')
      .select('ref.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ref.stage');
    if (tenantId) stageQb.andWhere('ref.tenant_id = :tenantId', { tenantId });
    if (facilityId) {
      stageQb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', {
        fid: facilityId,
      });
    }
    const stageRows = await stageQb.getRawMany<{ stage: string; count: string }>();
    const byStage = new Map(stageRows.map((r) => [r.stage, parseInt(r.count, 10)]));

    const tatQb = this.referralRepo
      .createQueryBuilder('ref')
      .select('AVG(EXTRACT(EPOCH FROM (ref.resultReadyAt - ref.collectedAt)) / 86400.0)', 'avgDays')
      .addSelect('COUNT(*)', 'completed')
      .addSelect(
        `SUM(CASE WHEN EXTRACT(EPOCH FROM (ref.resultReadyAt - ref.collectedAt)) / 86400.0 <= 7 THEN 1 ELSE 0 END)`,
        'meeting7',
      )
      .where('ref.collectedAt IS NOT NULL')
      .andWhere('ref.resultReadyAt IS NOT NULL');
    if (tenantId) tatQb.andWhere('ref.tenant_id = :tenantId', { tenantId });
    if (facilityId) {
      tatQb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', { fid: facilityId });
    }
    const tatRow = await tatQb.getRawOne<{
      avgDays: string | null;
      completed: string;
      meeting7: string | null;
    }>();

    const total = Array.from(byStage.values()).reduce((a, b) => a + b, 0);
    const inTransit = byStage.get(ReferralStage.IN_TRANSIT) || 0;
    const pendingAtHub =
      (byStage.get(ReferralStage.RECEIVED_AT_HUB) || 0) +
      (byStage.get(ReferralStage.PROCESSING) || 0);
    const resultsReady = byStage.get(ReferralStage.RESULT_READY) || 0;
    const rejected = byStage.get(ReferralStage.REJECTED) || 0;

    const completedCount = parseInt(tatRow?.completed || '0', 10);
    const avgTATDays = tatRow?.avgDays ? Math.round(parseFloat(tatRow.avgDays) * 10) / 10 : 0;
    const meeting7 = parseInt(tatRow?.meeting7 || '0', 10);
    const pctMeeting7Day = completedCount > 0 ? Math.round((meeting7 / completedCount) * 100) : 0;

    return {
      total,
      inTransit,
      pendingAtHub,
      resultsReady,
      rejected,
      avgTATDays,
      pctMeeting7Day,
      completedCount,
    };
  }

  async getTATStats(
    tenantId?: string,
    facilityId?: string,
    query?: TATStatsQueryDto,
  ): Promise<Record<string, any>> {
    const qb = this.referralRepo
      .createQueryBuilder('ref')
      .leftJoinAndSelect('ref.fromFacility', 'fromFacility')
      .leftJoinAndSelect('ref.toFacility', 'toFacility');

    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });

    const effectiveFacilityId = query?.facilityId || facilityId;
    if (effectiveFacilityId) {
      qb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', {
        fid: effectiveFacilityId,
      });
    }

    if (query?.fromDate && query?.toDate) {
      const f = new Date(query.fromDate).getTime();
      const t = new Date(query.toDate).getTime();
      if (Number.isFinite(f) && Number.isFinite(t) && f > t) {
        throw new BadRequestException('fromDate must be on or before toDate.');
      }
    }
    if (query?.fromDate) qb.andWhere('ref.created_at >= :fromDate', { fromDate: query.fromDate });
    if (query?.toDate) qb.andWhere('ref.created_at <= :toDate', { toDate: query.toDate });

    // P1-8: cap the dataset. Without a window/limit this loads every
    // referral into memory and is a DoS lever for any lab.read caller.
    // Default to the last 90 days when no fromDate provided, and hard
    // cap at 10000 rows for the per-stage TAT calc.
    if (!query?.fromDate) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      qb.andWhere('ref.created_at >= :defaultFrom', { defaultFrom: ninetyDaysAgo });
    }
    qb.orderBy('ref.created_at', 'DESC').limit(10000);

    const all = await qb.getMany();
    const truncated = all.length >= 10000;

    // Per-stage average durations (in hours)
    const stageDurations: Record<string, { total: number; count: number }> = {
      'collected→packaged': { total: 0, count: 0 },
      'packaged→in_transit': { total: 0, count: 0 },
      'in_transit→received_at_hub': { total: 0, count: 0 },
      'received_at_hub→processing': { total: 0, count: 0 },
      'processing→result_ready': { total: 0, count: 0 },
      'result_ready→result_delivered': { total: 0, count: 0 },
    };

    const diffHours = (a: Date | null, b: Date | null): number | null => {
      if (!a || !b) return null;
      return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
    };

    for (const r of all) {
      const pairs: [string, Date | null, Date | null][] = [
        ['collected→packaged', r.collectedAt, r.packagedAt],
        ['packaged→in_transit', r.packagedAt, r.shippedAt],
        ['in_transit→received_at_hub', r.shippedAt, r.receivedAtHubAt],
        ['received_at_hub→processing', r.receivedAtHubAt, r.processingStartedAt],
        ['processing→result_ready', r.processingStartedAt, r.resultReadyAt],
        ['result_ready→result_delivered', r.resultReadyAt, r.resultDeliveredAt],
      ];
      for (const [key, from, to] of pairs) {
        const h = diffHours(from, to);
        if (h !== null && h >= 0) {
          stageDurations[key].total += h;
          stageDurations[key].count += 1;
        }
      }
    }

    const stageAvgHours = Object.entries(stageDurations).map(([stage, { total, count }]) => ({
      stage,
      avgHours: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
      count,
    }));

    // Bottleneck: stage with highest avg hours (with at least 1 sample)
    const withData = stageAvgHours.filter((s) => s.count > 0);
    const bottleneck =
      withData.length > 0
        ? withData.reduce((max, s) => (s.avgHours > max.avgHours ? s : max), withData[0])
        : null;

    // 7-day compliance
    const completed = all.filter((r) => r.collectedAt && r.resultReadyAt);
    const meeting7Day = completed.filter((r) => {
      const days =
        (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;

    // Breakdown by route
    const routeMap = new Map<
      string,
      { count: number; totalHours: number; fromName: string; toName: string }
    >();
    for (const r of completed) {
      const key = `${r.fromFacilityId}→${r.toFacilityId}`;
      const hours =
        (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime()) /
        (1000 * 60 * 60);
      const existing = routeMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalHours += hours;
      } else {
        routeMap.set(key, {
          count: 1,
          totalHours: hours,
          fromName: r.fromFacility?.name || r.fromFacilityId,
          toName: r.toFacility?.name || r.toFacilityId,
        });
      }
    }
    const routeBreakdown = Array.from(routeMap.values()).map((v) => ({
      from: v.fromName,
      to: v.toName,
      count: v.count,
      avgDays: Math.round((v.totalHours / v.count / 24) * 10) / 10,
    }));

    return {
      stageAvgHours,
      bottleneck: bottleneck ? { stage: bottleneck.stage, avgHours: bottleneck.avgHours } : null,
      pctMeeting7Day: completed.length > 0 ? Math.round((meeting7Day / completed.length) * 100) : 0,
      completedCount: completed.length,
      totalReferrals: all.length,
      routeBreakdown,
      truncated,
      windowDays: query?.fromDate ? null : 90,
    };
  }
}
