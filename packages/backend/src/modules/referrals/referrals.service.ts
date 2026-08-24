import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, LessThanOrEqual } from 'typeorm';
import {
  Referral,
  ReferralPriority,
  ReferralStatus,
} from '../../database/entities/referral.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { localDateString } from '../../common/utils/timezone.util';
import {
  CreateReferralDto,
  AcceptReferralDto,
  RejectReferralDto,
  CompleteReferralDto,
  ReferralFilterDto,
} from './dto/referral.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(Referral)
    private referralRepository: Repository<Referral>,
    private readonly dataSource: DataSource,
    // @Inject is required beside @Optional with a union type — without a token
    // Nest injects undefined and the guard below reads as "notifications off".
    @Optional()
    @Inject(InAppNotificationsService)
    private readonly inAppNotifications: InAppNotificationsService | null,
  ) {}

  async create(
    dto: CreateReferralDto,
    userId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<Referral> {
    const tid = requireTenantId(tenantId);

    // A facility referring to itself put the same referral on both its own
    // incoming and outgoing worklists — a data-entry slip that reads as a real
    // transfer. Moving a patient between departments of one hospital is an
    // internal referral and does not name a destination facility.
    if (dto.toFacilityId && dto.toFacilityId === facilityId) {
      throw new BadRequestException(
        'A facility cannot refer a patient to itself — use an internal referral for a department transfer',
      );
    }

    // Calculate expiry date (default 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Serialize number generation per tenant/month: MAX+1 with no lock (and
    // no tenant filter) raced under concurrent creates.
    const saved = await this.referralRepository.manager.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `referral_num_${tid}`,
      ]);
      const referralNumber = await this.generateReferralNumber(tid, manager);

      const referral = manager.create(Referral, {
        ...dto,
        referralNumber,
        fromFacilityId: facilityId,
        referredById: userId,
        expiryDate,
        status: ReferralStatus.PENDING,
        tenantId: tid,
      });

      return manager.save(Referral, referral);
    });

    // Tell the receiving facility. Nothing announced an incoming referral
    // before: an emergency transfer sat unseen until somebody happened to open
    // the incoming list. Only in-tenant destinations can be told — an
    // out-referral to a hospital that is not on this system has nobody here to
    // notify.
    if (saved.toFacilityId) {
      await this.notifyReceivingFacility(saved, tid);
    }

    return saved;
  }

  private async notifyReceivingFacility(referral: Referral, tenantId: string): Promise<void> {
    if (!this.inAppNotifications || !referral.toFacilityId) return;
    try {
      const targets = await this.inAppNotifications.getUserIdsByRole(
        ['doctor', 'nurse', 'charge_nurse', 'receptionist', 'administrator'],
        referral.toFacilityId,
        tenantId,
      );
      if (targets.length === 0) return;
      const urgent = referral.priority !== ReferralPriority.ROUTINE;
      await this.inAppNotifications.notifyMany(
        targets,
        {
          type: InAppNotificationType.GENERAL,
          title: urgent ? `${referral.priority.toUpperCase()} referral incoming` : 'Incoming referral',
          message: `${referral.referralNumber}: ${referral.reason.replace(/_/g, ' ')} — ${referral.clinicalSummary?.slice(0, 120) ?? ''}`,
          facilityId: referral.toFacilityId,
          metadata: {
            kind: 'incoming_referral',
            referralId: referral.id,
            priority: referral.priority,
          },
        },
        tenantId,
      );
    } catch (err: any) {
      this.logger.warn(`Incoming referral notification failed: ${err.message}`);
    }
  }

  async findAll(
    filter: ReferralFilterDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const query = this.referralRepository
      .createQueryBuilder('referral')
      .leftJoinAndSelect('referral.patient', 'patient')
      .leftJoinAndSelect('referral.fromFacility', 'fromFacility')
      .leftJoinAndSelect('referral.toFacility', 'toFacility')
      .leftJoinAndSelect('referral.referredBy', 'referredBy');

    // Filter by facility (either from or to)
    query.andWhere(
      '(referral.from_facility_id = :facilityId OR referral.to_facility_id = :facilityId)',
      { facilityId },
    );

    query.andWhere('referral.tenant_id = :tenantId', { tenantId: tid });

    if (filter.status) {
      query.andWhere('referral.status = :status', { status: filter.status });
    }
    if (filter.type) {
      query.andWhere('referral.type = :type', { type: filter.type });
    }
    if (filter.priority) {
      query.andWhere('referral.priority = :priority', { priority: filter.priority });
    }
    if (filter.patientId) {
      query.andWhere('referral.patient_id = :patientId', { patientId: filter.patientId });
    }
    if (filter.fromDate && filter.toDate) {
      query.andWhere('referral.created_at BETWEEN :fromDate AND :toDate', {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      });
    }

    query.orderBy('referral.created_at', 'DESC');

    return query.getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<Referral> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const referral = await this.referralRepository.findOne({
      where,
      relations: [
        'patient',
        'fromFacility',
        'toFacility',
        'referredBy',
        'acceptedBy',
        'sourceEncounter',
        'destinationEncounter',
      ],
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    return referral;
  }

  async findByPatient(patientId: string, tenantId?: string): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { patientId };
    where.tenantId = tid;

    return this.referralRepository.find({
      where,
      relations: ['fromFacility', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Referrals addressed TO this facility.
   *
   * `status` is a filter, NOT a hardcoded PENDING. Pinning it to PENDING meant a
   * referral vanished from the receiving facility's list the instant they
   * accepted it — so it could never be worked or completed, and the whole
   * inbound half of the workflow dead-ended at ACCEPTED. (Same "vanishing
   * worklist" class as the labour board and surgery day list.)
   */
  async getIncomingReferrals(
    facilityId: string,
    tenantId?: string,
    status?: ReferralStatus,
  ): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { toFacilityId: facilityId };
    where.tenantId = tid;
    if (status) where.status = status;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'fromFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingReferrals(facilityId: string, tenantId?: string): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { fromFacilityId: facilityId };
    where.tenantId = tid;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Receiving-side actions (accept/reject/complete) must come from the
   * facility the referral is addressed to; cancel must come from either end.
   * Without this, any user in a multi-facility tenant could act on another
   * facility's referrals.
   */
  private assertFacilitySide(
    referral: Referral,
    facilityId: string | undefined,
    side: 'to' | 'from' | 'either',
  ): void {
    if (!facilityId) return; // single-facility deployments have no context to check
    const isTo = referral.toFacilityId === facilityId;
    const isFrom = referral.fromFacilityId === facilityId;
    const ok = side === 'to' ? isTo : side === 'from' ? isFrom : isTo || isFrom;
    if (!ok) {
      throw new BadRequestException(
        `This referral is not addressed ${side === 'to' ? 'to' : 'from'} your facility`,
      );
    }
  }

  async accept(
    id: string,
    dto: AcceptReferralDto,
    userId: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('Only pending referrals can be accepted');
    }

    referral.status = ReferralStatus.ACCEPTED;
    referral.acceptedById = userId;
    referral.acceptedAt = new Date();

    if (dto.appointmentDate) {
      referral.appointmentDate = new Date(dto.appointmentDate);
    }
    if (dto.appointmentTime) {
      referral.appointmentTime = dto.appointmentTime;
    }
    if (dto.notes) {
      referral.feedbackNotes = dto.notes;
    }

    return this.referralRepository.save(referral);
  }

  async reject(
    id: string,
    dto: RejectReferralDto,
    userId: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('Only pending referrals can be rejected');
    }

    referral.status = ReferralStatus.REJECTED;
    referral.rejectionReason = dto.rejectionReason;
    // Accepting recorded who and when; rejecting recorded only a reason. Turning
    // a referred patient away is a decision the referring unit may need to
    // question, and nobody's name was against it.
    referral.rejectedById = userId ?? null;
    referral.rejectedAt = new Date();

    return this.referralRepository.save(referral);
  }

  async complete(
    id: string,
    dto: CompleteReferralDto,
    userId: string | undefined,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

    if (referral.status !== ReferralStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted referrals can be completed');
    }

    referral.status = ReferralStatus.COMPLETED;
    referral.completedAt = new Date();
    referral.completedById = userId ?? null;

    if (dto.destinationEncounterId) {
      referral.destinationEncounterId = dto.destinationEncounterId;
    }
    if (dto.feedbackNotes) {
      referral.feedbackNotes = dto.feedbackNotes;
    }

    return this.referralRepository.save(referral);
  }

  async cancel(
    id: string,
    reason: string,
    userId: string | undefined,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'either');

    if (referral.status === ReferralStatus.COMPLETED) {
      throw new BadRequestException('Completed referrals cannot be cancelled');
    }

    referral.status = ReferralStatus.CANCELLED;
    referral.rejectionReason = reason;
    referral.cancelledById = userId ?? null;
    referral.cancelledAt = new Date();

    return this.referralRepository.save(referral);
  }

  /**
   * Expire referrals nobody answered.
   *
   * `checkExpiredReferrals` existed, was correct, and was called from nowhere:
   * no cron, no route, no other service. So `expiry_date` and the EXPIRED
   * status were decorative, and a referral sent in 2025 and never answered
   * still sat at the top of the receiving facility's pending list. Runs across
   * tenants in system context, like the other maintenance crons.
   */
  @Cron('15 1 * * *', { name: 'expire-stale-referrals' })
  async expireStaleReferralsCron(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `UPDATE referrals
            SET status = $1, updated_at = NOW()
          WHERE status = $2
            AND expiry_date IS NOT NULL
            AND expiry_date <= NOW()`,
        [ReferralStatus.EXPIRED, ReferralStatus.PENDING],
      );
      const affected = Array.isArray(result) ? result[1] : 0;
      if (affected) this.logger.log(`Expired ${affected} unanswered referral(s)`);
    } catch (err: any) {
      this.logger.warn(`Referral expiry sweep failed: ${err.message}`);
    }
  }

  async checkExpiredReferrals(tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const now = new Date();
    const where: any = {
      status: ReferralStatus.PENDING,
      expiryDate: LessThanOrEqual(now),
    };
    where.tenantId = tid;
    const result = await this.referralRepository.update(where, { status: ReferralStatus.EXPIRED });

    return result.affected || 0;
  }

  async getReferralStats(facilityId: string, fromDate: Date, toDate: Date, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const incomingWhere: any = {
      toFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    incomingWhere.tenantId = tid;

    const outgoingWhere: any = {
      fromFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    outgoingWhere.tenantId = tid;

    const completedWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.COMPLETED,
      createdAt: Between(fromDate, toDate),
    };
    completedWhere.tenantId = tid;

    const pendingWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.PENDING,
    };
    pendingWhere.tenantId = tid;

    const incoming = await this.referralRepository.count({ where: incomingWhere });
    const outgoing = await this.referralRepository.count({ where: outgoingWhere });
    const completed = await this.referralRepository.count({ where: completedWhere });
    const pending = await this.referralRepository.count({ where: pendingWhere });

    return { incoming, outgoing, completed, pending };
  }

  private async generateReferralNumber(
    tenantId: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    // The hospital's month, not the server's: getFullYear/getMonth run in UTC,
    // so for the first three hours of the 1st the number carried last month.
    const prefix = `REF${localDateString(new Date()).slice(0, 7).replace('-', '')}`;

    const lastReferral = await manager
      .createQueryBuilder(Referral, 'referral')
      .where('referral.referral_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('referral.tenant_id = :tenantId', { tenantId })
      .orderBy('referral.referral_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastReferral) {
      const lastSequence = parseInt(lastReferral.referralNumber.slice(-5), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(5, '0')}`;
  }
}
