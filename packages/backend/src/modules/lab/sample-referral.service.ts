import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { SampleReferral, ReferralStage, ReferralPriority } from '../../database/entities/sample-referral.entity';
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

  private async generateReferralNumber(tenantId?: string): Promise<string> {
    const now = new Date();
    const prefix = `SRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const qb = this.referralRepo.createQueryBuilder('ref');
    qb.where('ref.referralNumber LIKE :prefix', { prefix: `${prefix}%` });
    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });
    const count = await qb.getCount();

    const seq = String(count + 1).padStart(5, '0');
    return `${prefix}-${seq}`;
  }

  async create(dto: CreateSampleReferralDto, userId: string, tenantId?: string): Promise<SampleReferral> {
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

    const referralNumber = await this.generateReferralNumber(tenantId);

    const referral = this.referralRepo.create({
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

    return this.referralRepo.save(referral);
  }

  async findAll(tenantId?: string, facilityId?: string, query?: SampleReferralQueryDto): Promise<SampleReferral[]> {
    const qb = this.referralRepo.createQueryBuilder('ref')
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
      qb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', { fid: effectiveFacilityId });
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
    qb.addOrderBy(
      `CASE ref.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END`,
      'ASC',
    );
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

  async updateStage(id: string, dto: UpdateStageDto, userId: string, tenantId?: string): Promise<SampleReferral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.stage === ReferralStage.REJECTED) {
      throw new BadRequestException('Cannot update stage of a rejected referral');
    }
    if (referral.stage === ReferralStage.RESULT_DELIVERED) {
      throw new BadRequestException('Referral is already fully delivered');
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
          await this.inAppNotificationsService.create({
            targetUserId: referral.collectedById || userId,
            facilityId: referral.fromFacilityId,
            type: InAppNotificationType.LAB_RESULT_READY,
            title: 'Referral Result Ready',
            message: `Result is ready for referral ${referral.referralNumber}. Patient: ${referral.patient?.fullName || ''}`,
            metadata: { referralId: referral.id, referralNumber: referral.referralNumber },
          }, tenantId);
        } catch (err) {
          this.logger.warn(`Failed to send result notification for ${referral.referralNumber}: ${err.message}`);
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

  async reject(id: string, dto: RejectReferralDto, userId: string, tenantId?: string): Promise<SampleReferral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.stage === ReferralStage.RESULT_DELIVERED) {
      throw new BadRequestException('Cannot reject a delivered referral');
    }

    referral.stage = ReferralStage.REJECTED;
    referral.rejectedAt = new Date();
    referral.rejectionReason = dto.rejectionReason;

    try {
      await this.inAppNotificationsService.create({
        targetUserId: referral.collectedById || userId,
        facilityId: referral.fromFacilityId,
        type: InAppNotificationType.LAB_RESULT_READY,
        title: 'Sample Referral Rejected',
        message: `Referral ${referral.referralNumber} was rejected: ${dto.rejectionReason}`,
        metadata: { referralId: referral.id, referralNumber: referral.referralNumber },
      }, tenantId);
    } catch (err) {
      this.logger.warn(`Failed to send rejection notification for ${referral.referralNumber}: ${err.message}`);
    }

    return this.referralRepo.save(referral);
  }

  async getDashboard(tenantId?: string, facilityId?: string): Promise<Record<string, any>> {
    const qb = this.referralRepo.createQueryBuilder('ref');
    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });
    if (facilityId) {
      qb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', { fid: facilityId });
    }

    const all = await qb.getMany();

    const inTransit = all.filter(r => r.stage === ReferralStage.IN_TRANSIT).length;
    const pendingAtHub = all.filter(r =>
      r.stage === ReferralStage.RECEIVED_AT_HUB || r.stage === ReferralStage.PROCESSING,
    ).length;
    const resultsReady = all.filter(r => r.stage === ReferralStage.RESULT_READY).length;
    const rejected = all.filter(r => r.stage === ReferralStage.REJECTED).length;

    // Calculate average TAT (collected → result_ready) in days for completed referrals
    const completed = all.filter(r => r.collectedAt && r.resultReadyAt);
    let avgTATDays = 0;
    if (completed.length > 0) {
      const totalMs = completed.reduce((sum, r) => {
        return sum + (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime());
      }, 0);
      avgTATDays = Math.round((totalMs / completed.length / (1000 * 60 * 60 * 24)) * 10) / 10;
    }

    // % meeting 7-day target
    const meeting7Day = completed.filter(r => {
      const days = (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;
    const pctMeeting7Day = completed.length > 0 ? Math.round((meeting7Day / completed.length) * 100) : 0;

    return {
      total: all.length,
      inTransit,
      pendingAtHub,
      resultsReady,
      rejected,
      avgTATDays,
      pctMeeting7Day,
      completedCount: completed.length,
    };
  }

  async getTATStats(tenantId?: string, facilityId?: string, query?: TATStatsQueryDto): Promise<Record<string, any>> {
    const qb = this.referralRepo.createQueryBuilder('ref')
      .leftJoinAndSelect('ref.fromFacility', 'fromFacility')
      .leftJoinAndSelect('ref.toFacility', 'toFacility');

    if (tenantId) qb.andWhere('ref.tenant_id = :tenantId', { tenantId });

    const effectiveFacilityId = query?.facilityId || facilityId;
    if (effectiveFacilityId) {
      qb.andWhere('(ref.fromFacilityId = :fid OR ref.toFacilityId = :fid)', { fid: effectiveFacilityId });
    }

    if (query?.fromDate) qb.andWhere('ref.created_at >= :fromDate', { fromDate: query.fromDate });
    if (query?.toDate) qb.andWhere('ref.created_at <= :toDate', { toDate: query.toDate });

    const all = await qb.getMany();

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
    const withData = stageAvgHours.filter(s => s.count > 0);
    const bottleneck = withData.length > 0
      ? withData.reduce((max, s) => (s.avgHours > max.avgHours ? s : max), withData[0])
      : null;

    // 7-day compliance
    const completed = all.filter(r => r.collectedAt && r.resultReadyAt);
    const meeting7Day = completed.filter(r => {
      const days = (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;

    // Breakdown by route
    const routeMap = new Map<string, { count: number; totalHours: number; fromName: string; toName: string }>();
    for (const r of completed) {
      const key = `${r.fromFacilityId}→${r.toFacilityId}`;
      const hours = (new Date(r.resultReadyAt).getTime() - new Date(r.collectedAt).getTime()) / (1000 * 60 * 60);
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
    const routeBreakdown = Array.from(routeMap.values()).map(v => ({
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
    };
  }
}
